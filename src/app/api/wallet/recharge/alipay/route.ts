import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { walletRecharges } from "@/lib/db/schema";
import { getAlipaySdk } from "@/lib/alipay";
import { centsToYuanString } from "@/lib/alipay/plans";
import { id as genId } from "@/lib/id";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let amount: number;
  try {
    const body = (await request.json()) as { amount: number };
    amount = body.amount;
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  if (!Number.isInteger(amount) || amount < 100) {
    return NextResponse.json({ error: "充值金额至少 1 元" }, { status: 400 });
  }

  const outTradeNo = ulid();
  const baseUrl = process.env.BETTER_AUTH_URL;

  try {
    await db.insert(walletRecharges).values({
      id: genId(),
      userId: session.user.id,
      outTradeNo,
      provider: "alipay",
      amount,
      status: "pending",
    });

    const url = getAlipaySdk().pageExecute("alipay.trade.page.pay", "GET", {
      bizContent: {
        out_trade_no: outTradeNo,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: centsToYuanString(amount),
        subject: `钱包充值 ${centsToYuanString(amount)} 元`,
      },
      returnUrl: `${baseUrl}/api/wallet/recharge/alipay/return`,
      notifyUrl: `${baseUrl}/api/wallet/recharge/alipay/notify`,
    });

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Wallet Alipay] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
