import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ error: "未找到订阅记录" }, { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.BETTER_AUTH_URL}/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Stripe Portal] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
