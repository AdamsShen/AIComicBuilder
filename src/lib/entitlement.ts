import { db } from "@/lib/db";
import { subscriptions, alipayOrders, users } from "@/lib/db/schema";
import { and, eq, gt, inArray, desc } from "drizzle-orm";

export type MembershipSource = "stripe" | "alipay" | null;

export interface Membership {
  isPro: boolean;
  source: MembershipSource;
  /** 会员到期时间；无有效会员时为 null。 */
  expiresAt: Date | null;
}

/**
 * 统一的会员权益查询：聚合 Stripe 订阅与支付宝一次性购买，取较晚的到期时间。
 *
 * 说明：当前仅用于「状态展示」，不对生成接口做付费拦截（与现有 Stripe 行为一致）。
 *
 * 输入：userId（登录用户 id）
 * 输出示例：{ isPro: true, source: "alipay", expiresAt: 2026-08-10T... }
 */
export async function getMembership(userId: string): Promise<Membership> {
  const now = new Date();

  // Stripe：有效订阅（active/trialing 且未过期），取最晚到期
  const [stripeSub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["active", "trialing"]),
        gt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);

  // 支付宝：已付款且未过期的订单，取最晚到期
  const [alipayOrder] = await db
    .select()
    .from(alipayOrders)
    .where(
      and(
        eq(alipayOrders.userId, userId),
        eq(alipayOrders.status, "paid"),
        gt(alipayOrders.periodEnd, now),
      ),
    )
    .orderBy(desc(alipayOrders.periodEnd))
    .limit(1);

  const stripeEnd = stripeSub?.currentPeriodEnd ?? null;
  const alipayEnd = alipayOrder?.periodEnd ?? null;

  if (!stripeEnd && !alipayEnd) {
    return { isPro: false, source: null, expiresAt: null };
  }

  // 两渠道都有效时，取较晚到期，并归因到该渠道
  if (stripeEnd && alipayEnd) {
    const source = alipayEnd > stripeEnd ? "alipay" : "stripe";
    const expiresAt = alipayEnd > stripeEnd ? alipayEnd : stripeEnd;
    return { isPro: true, source, expiresAt };
  }

  return {
    isPro: true,
    source: stripeEnd ? "stripe" : "alipay",
    expiresAt: stripeEnd ?? alipayEnd,
  };
}

/**
 * 用户是否已拥有任一套餐（可进入项目页的门槛）。
 * true 的条件：已选免费套餐（users.plan === "free"）或 当前是 Pro 会员。
 * false 表示尚未选择任何套餐（新用户），应被引导到定价页选择。
 */
export async function hasActivePlan(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.plan === "free") return true;

  const membership = await getMembership(userId);
  return membership.isPro;
}
