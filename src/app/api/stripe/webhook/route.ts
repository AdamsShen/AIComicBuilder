import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sub = event.data.object as Stripe.Subscription;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const customerId = sub.customer as string;
      const userId = sub.metadata?.userId;

      if (!userId) {
        console.warn("[Stripe Webhook] No userId in subscription metadata");
        break;
      }

      const existing = (
        await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, sub.id))
          .limit(1)
      )[0];

      const data = {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0]?.price.id ?? "",
        status: sub.status as typeof subscriptions.$inferSelect.status,
        interval: (sub.items.data[0]?.price.recurring?.interval === "year"
          ? "year"
          : "month") as "month" | "year",
        currentPeriodStart: new Date((sub as any).current_period_start * 1000),
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        cancelAtPeriodEnd: (sub as any).cancel_at_period_end ?? false,
        canceledAt: (sub as any).canceled_at
          ? new Date((sub as any).canceled_at * 1000)
          : null,
        updatedAt: new Date(),
      };

      if (existing) {
        await db
          .update(subscriptions)
          .set(data)
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      } else {
        await db.insert(subscriptions).values({
          id: crypto.randomUUID(),
          ...data,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
