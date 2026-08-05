import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { walletRecharges } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
    return NextResponse.json({ error: "充值金额至少 1 美元" }, { status: 400 });
  }

  const outTradeNo = genId();
  const baseUrl = process.env.BETTER_AUTH_URL;

  try {
    // 先落一条待支付充值记录
    await db.insert(walletRecharges).values({
      id: genId(),
      userId: session.user.id,
      outTradeNo,
      provider: "stripe",
      amount,
      status: "pending",
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: `AI Comic Builder - Wallet Top-up $${(amount / 100).toFixed(2)}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/wallet?recharge=success`,
      cancel_url: `${baseUrl}/wallet?recharge=canceled`,
      metadata: {
        userId: session.user.id,
        type: "wallet_recharge",
        outTradeNo,
      },
      payment_method_types: ["card", "link"],
      billing_address_collection: "auto",
    });

    // 保存 provider_session_id，以便 webhook 未到达时可以通过 sync 接口兜底
    await db
      .update(walletRecharges)
      .set({ providerSessionId: checkoutSession.id })
      .where(eq(walletRecharges.outTradeNo, outTradeNo))
      .run();

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Wallet Stripe] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
