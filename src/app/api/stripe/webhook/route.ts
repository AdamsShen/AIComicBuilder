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
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // constructEvent 返回的是原始 JSON，字段为 snake_case；SDK 类型是 camelCase。
  // 为兼容实际运行时，通过 as any 访问，并同时对两种命名做 fallback。
  const obj = event.data.object as any;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const customerId = obj.customer as string;
      const userId = obj.metadata?.userId as string | undefined;

      if (!userId) {
        console.warn("[Stripe Webhook] No userId in subscription metadata");
        break;
      }

      // Stripe webhook 体用 snake_case（current_period_start），但某些 SDK 版本可能转换。
      // 双 fallback 确保始终取到值。
      // current_period_start/end 在 items.data[0] 上，不在 Subscription 根对象
      const firstItem = obj.items?.data?.[0];
      const periodStart =
        firstItem?.current_period_start ?? firstItem?.currentPeriodStart ?? 0;
      const periodEnd =
        firstItem?.current_period_end ?? firstItem?.currentPeriodEnd ?? 0;
      const cancelAtEnd =
        obj.cancel_at_period_end ?? obj.cancelAtPeriodEnd ?? false;
      const canceled =
        obj.canceled_at ?? obj.canceledAt ?? null;
      const priceId = firstItem?.price?.id ?? "";
      const recurringInterval = firstItem?.price?.recurring?.interval;
      const amount = firstItem?.price?.unit_amount ?? null;

      console.log("[Stripe Webhook] subscription:", {
        id: obj.id,
        userId,
        periodStart,
        periodEnd,
        status: obj.status,
        interval: recurringInterval,
      });

      if (!periodStart || !periodEnd) {
        console.error(
          "[Stripe Webhook] Missing period timestamps — raw keys:",
          Object.keys(obj).filter((k: string) =>
            /current|period|cancel/.test(k),
          ),
        );
        break;
      }

      const values = {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: obj.id as string,
        stripePriceId: priceId,
        amount: amount,
        currency: obj.currency ?? "usd",
        status: (obj.status as string) as typeof subscriptions.$inferSelect.status,
        interval: (recurringInterval === "year" ? "year" : "month") as "month" | "year",
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: cancelAtEnd,
        canceledAt: canceled ? new Date(canceled * 1000) : null,
        updatedAt: new Date(),
      };

      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, obj.id as string))
        .limit(1);

      if (existing) {
        await db
          .update(subscriptions)
          .set(values)
          .where(eq(subscriptions.stripeSubscriptionId, obj.id as string));
      } else {
        await db.insert(subscriptions).values({
          id: crypto.randomUUID(),
          ...values,
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
        .where(eq(subscriptions.stripeSubscriptionId, obj.id as string));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
