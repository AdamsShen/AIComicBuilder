import { NextResponse } from "next/server";
import { getAlipaySdk } from "@/lib/alipay";
import { reconcileOrder } from "@/lib/alipay/reconcile";

const SUCCESS_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

/**
 * 支付宝同步回跳（用户支付后浏览器带签名参数 GET 回来）。
 * 在这里先「主动查单 + 落库」把会员开通，再跳转项目落地页——
 * 必须先于 dashboard 的套餐门槛（requirePlan）完成，否则刚付款的用户
 * 会因订单尚未落库而被判定无套餐、误跳回定价页。
 * 本地无公网 notify 时，这条同步回跳是开通会员的主要路径。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // 支付宝会把 out_trade_no 等参数附加到 return_url 上
  const outTradeNo = url.searchParams.get("out_trade_no");

  try {
    if (outTradeNo) {
      const result = (await getAlipaySdk().exec("alipay.trade.query", {
        bizContent: { out_trade_no: outTradeNo },
      })) as Record<string, string>;

      if (
        result.code === "10000" &&
        SUCCESS_STATUSES.has(result.trade_status)
      ) {
        await reconcileOrder({
          outTradeNo,
          alipayTradeNo: result.trade_no,
          totalAmount: result.total_amount,
        });
      }
    }
  } catch (err) {
    // 查单/落库失败不阻塞回跳；异步 notify 仍会兜底开通
    console.error(
      "[Alipay Return] Error:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 用配置的 BETTER_AUTH_URL；未配置时回退到本次请求来源，避免拼出 "undefined/..." 而 500
  return NextResponse.redirect(
    new URL(
      "/?checkout=success&provider=alipay",
      process.env.BETTER_AUTH_URL || request.url,
    ),
  );
}
