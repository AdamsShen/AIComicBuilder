import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { subscriptions, alipayOrders } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // Stripe 订阅：取最新一条（不限状态，展示历史记录）
  const [stripeSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  // 支付宝订单：取所有已付款的
  const alipayPaidOrders = await db
    .select()
    .from(alipayOrders)
    .where(
      and(eq(alipayOrders.userId, userId), eq(alipayOrders.status, "paid")),
    )
    .orderBy(desc(alipayOrders.paidAt));

  // 判断当前有效会员来源
  const stripeActive =
    stripeSub &&
    ["active", "trialing"].includes(stripeSub.status) &&
    stripeSub.currentPeriodEnd > now;
  const alipayActive = alipayPaidOrders.filter(
    (o) => o.periodEnd && o.periodEnd > now,
  );

  // 格式化 Stripe 订阅信息
  const stripeInfo = stripeSub
    ? {
        id: stripeSub.stripeSubscriptionId,
        status: stripeSub.status,
        interval: stripeSub.interval,
        priceId: stripeSub.stripePriceId,
        currentPeriodStart: stripeSub.currentPeriodStart,
        currentPeriodEnd: stripeSub.currentPeriodEnd,
        cancelAtPeriodEnd: stripeSub.cancelAtPeriodEnd,
        canceledAt: stripeSub.canceledAt,
        createdAt: stripeSub.createdAt,
      }
    : null;

  // 格式化支付宝订单列表
  const alipayInfo = alipayPaidOrders.map((o) => ({
    outTradeNo: o.outTradeNo,
    alipayTradeNo: o.alipayTradeNo,
    interval: o.interval,
    amount: o.amount,
    periodStart: o.periodStart,
    periodEnd: o.periodEnd,
    paidAt: o.paidAt,
  }));

  // 当前有效渠道
  let activeSource: "stripe" | "alipay" | null = null;
  if (stripeActive) activeSource = "stripe";
  else if (alipayActive.length > 0) activeSource = "alipay";

  return NextResponse.json({
    activeSource,
    stripe: stripeInfo,
    alipay: alipayInfo,
  });
}
