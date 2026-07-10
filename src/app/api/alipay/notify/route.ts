import { getAlipaySdk } from "@/lib/alipay";
import { reconcileOrder } from "@/lib/alipay/reconcile";

const SUCCESS_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

/**
 * 支付宝异步通知回调（服务器到服务器，无登录态）。
 * 支付宝以 application/x-www-form-urlencoded POST 过来，必须验签后处理，
 * 并返回纯文本 "success"，否则支付宝会不断重推。
 */
export async function POST(request: Request) {
  // 解析表单字段为普通对象（含 sign / sign_type，验签需要）
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  try {
    // 验签失败返回 200 + 纯文本 "failure"（支付宝按正文判定，非 success 即重推）
    if (!getAlipaySdk().checkNotifySign(params)) {
      console.error("[Alipay Notify] signature verification failed");
      return new Response("failure", { status: 200 });
    }

    const tradeStatus = params.trade_status;
    if (SUCCESS_STATUSES.has(tradeStatus)) {
      // 必要字段缺失则无法处理，直接受理结束（避免无谓 DB 查询与误导日志）
      if (!params.out_trade_no || !params.total_amount) {
        console.error(
          "[Alipay Notify] missing out_trade_no/total_amount in payload",
        );
        return new Response("success", { status: 200 });
      }

      const result = await reconcileOrder({
        outTradeNo: params.out_trade_no,
        alipayTradeNo: params.trade_no,
        totalAmount: params.total_amount,
      });

      // 订单不存在或金额不符：不再重推（返回 success 结束），仅记录
      if (!result.ok) {
        console.error(
          `[Alipay Notify] reconcile skipped: ${result.reason} outTradeNo=${params.out_trade_no}`,
        );
      }
    }

    // 已受理（含非成功状态如交易关闭），返回 success 结束通知
    return new Response("success", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Alipay Notify] Error:", message);
    // 处理异常时返回非 success，让支付宝稍后重推
    return new Response("failure", { status: 500 });
  }
}
