import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { creditWalletRecharge } from "@/lib/wallet";
import { getUsdToCnyRate } from "@/lib/wallet-plans";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const obj = event.data.object as any;

  switch (event.type) {
    case "checkout.session.completed": {
      const metadata = obj.metadata ?? {};
      if (metadata?.type !== "wallet_recharge") break;

      const userId = metadata.userId as string | undefined;
      const outTradeNo = metadata.outTradeNo as string | undefined;
      const usdAmount = obj.amount_total as number | undefined;

      if (!userId || !outTradeNo || !usdAmount) {
        console.error("[Stripe Webhook] Missing wallet recharge metadata");
        break;
      }

      // Stripe 收美元，按汇率转为人民币分入账
      const cnyAmount = Math.round(usdAmount * getUsdToCnyRate());

      await creditWalletRecharge({
        outTradeNo,
        userId,
        amount: cnyAmount,
        providerSessionId: obj.id as string,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
