import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { alipayOrders } from "@/lib/db/schema";
import { getAlipaySdk } from "@/lib/alipay";
import {
  getAlipayAmountCents,
  centsToYuanString,
  getAlipaySubject,
} from "@/lib/alipay/plans";

/**
 * 创建支付宝电脑网站支付订单，返回跳转收银台的 URL。
 * 请求体：{ interval: "month" | "year" }
 * 响应：{ url: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let interval: "month" | "year";
  try {
    const body = (await request.json()) as { interval: "month" | "year" };
    interval = body.interval;
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
  if (interval !== "month" && interval !== "year") {
    return NextResponse.json({ error: "无效的计费周期" }, { status: 400 });
  }

  const amount = getAlipayAmountCents(interval);
  const outTradeNo = ulid();
  const baseUrl = process.env.BETTER_AUTH_URL;

  try {
    // 先落一条待支付订单，回调时凭 out_trade_no 关联
    await db.insert(alipayOrders).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      outTradeNo,
      planKey: "pro",
      interval,
      amount,
      status: "pending",
    });

    // GET 模式返回可直接跳转的收银台链接
    const url = getAlipaySdk().pageExecute("alipay.trade.page.pay", "GET", {
      bizContent: {
        out_trade_no: outTradeNo,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: centsToYuanString(amount),
        subject: getAlipaySubject(interval),
      },
      // 同步回跳先经 /api/alipay/return 落库开通会员，再进项目页
      returnUrl: `${baseUrl}/api/alipay/return`,
      notifyUrl: `${baseUrl}/api/alipay/notify`,
    });

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Alipay Create] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
