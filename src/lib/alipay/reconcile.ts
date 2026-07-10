import { db } from "@/lib/db";
import { alipayOrders } from "@/lib/db/schema";
import { and, eq, gt, desc } from "drizzle-orm";

interface ReconcileInput {
  outTradeNo: string;
  /** 支付宝交易号 trade_no，可选 */
  alipayTradeNo?: string;
  /** 支付宝返回的金额（元字符串，如 "138.00"），用于防篡改校验 */
  totalAmount: string;
}

interface ReconcileResult {
  ok: boolean;
  reason?: "order_not_found" | "amount_mismatch";
  alreadyPaid?: boolean;
}

/** 在 base 时间基础上增加一个计费周期。 */
function addInterval(base: Date, interval: "month" | "year"): Date {
  const d = new Date(base);
  if (interval === "year") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * 幂等地把一笔支付宝订单标记为已付款，并计算会员到期时间。
 * notify（异步通知）与 query（主动查单）共用此函数，保证两条路径落库一致。
 *
 * 会员叠加规则：periodEnd = max(now, 该用户已有有效会员到期) + 一个周期。
 *
 * 「读订单 → 判幂等 → 校验金额 → 取叠加基准 → 写入」整体放进同步事务，
 * 避免同一用户两笔并发对账读到同一基准、导致丢失一次会员叠加。
 *
 * 输入示例：{ outTradeNo: "01J...", alipayTradeNo: "2026...", totalAmount: "138.00" }
 * 输出示例：{ ok: true }（成功）/ { ok: true, alreadyPaid: true }（重复通知）
 */
export async function reconcileOrder(
  input: ReconcileInput,
): Promise<ReconcileResult> {
  const { outTradeNo, alipayTradeNo, totalAmount } = input;
  // 元 → 分做整数比对，兼容支付宝可能返回 "138" 或 "138.00" 的写法
  const paidCents = Math.round(Number(totalAmount) * 100);

  return db.transaction((tx): ReconcileResult => {
    const [order] = tx
      .select()
      .from(alipayOrders)
      .where(eq(alipayOrders.outTradeNo, outTradeNo))
      .limit(1)
      .all();

    if (!order) return { ok: false, reason: "order_not_found" };

    // 幂等：已处理过的订单直接返回，避免重复延长会员
    if (order.status === "paid") return { ok: true, alreadyPaid: true };

    // 金额必须与我方下单金额一致（按分整数比对），防止回调被篡改
    if (!Number.isFinite(paidCents) || paidCents !== order.amount) {
      console.error(
        `[Alipay Reconcile] amount mismatch: order=${order.amount}分 alipay=${totalAmount} outTradeNo=${outTradeNo}`,
      );
      return { ok: false, reason: "amount_mismatch" };
    }

    const now = new Date();

    // 取该用户当前最晚的有效会员到期，作为叠加基准
    const [latest] = tx
      .select()
      .from(alipayOrders)
      .where(
        and(
          eq(alipayOrders.userId, order.userId),
          eq(alipayOrders.status, "paid"),
          gt(alipayOrders.periodEnd, now),
        ),
      )
      .orderBy(desc(alipayOrders.periodEnd))
      .limit(1)
      .all();

    const base =
      latest?.periodEnd && latest.periodEnd > now ? latest.periodEnd : now;
    const periodEnd = addInterval(base, order.interval);

    tx
      .update(alipayOrders)
      .set({
        status: "paid",
        alipayTradeNo: alipayTradeNo ?? order.alipayTradeNo ?? null,
        periodStart: now,
        periodEnd,
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(alipayOrders.outTradeNo, outTradeNo))
      .run();

    return { ok: true };
  });
}
