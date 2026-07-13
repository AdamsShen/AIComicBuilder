import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/auth/get-session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { priceId, interval } = (await request.json()) as {
    priceId: string;
    interval: "month" | "year";
  };

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.BETTER_AUTH_URL}/?checkout=success`,
      cancel_url: `${process.env.BETTER_AUTH_URL}/pricing?checkout=canceled`,
      subscription_data: {
        metadata: {
          userId: session.user.id,
          interval,
        },
      },
      payment_method_types: ["card", "link"],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Stripe Checkout] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
