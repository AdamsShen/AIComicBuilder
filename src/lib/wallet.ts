import { db } from "@/lib/db";
import { walletBalance, walletRecharges, walletRecords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { id as genId } from "@/lib/id";
import type { InferSelectModel } from "drizzle-orm";

interface CreditRechargeInput {
  outTradeNo: string;
  userId: string;
  amount: number; // cents
  providerSessionId: string;
}

interface SpendInput {
  userId: string;
  amount: number; // cents
  description: string;
  referenceId?: string;
  referenceType?: "task" | "manual";
}

export async function getOrCreateBalance(
  userId: string
): Promise<InferSelectModel<typeof walletBalance>> {
  const rows = await db.select().from(walletBalance).where(eq(walletBalance.userId, userId));
  if (rows.length > 0) return rows[0];

  const [row] = await db.insert(walletBalance).values({ userId }).returning();
  return row;
}

export async function creditWalletRecharge(input: CreditRechargeInput): Promise<void> {
  const { outTradeNo, userId, amount, providerSessionId } = input;

  const [recharge] = await db
    .select()
    .from(walletRecharges)
    .where(eq(walletRecharges.outTradeNo, outTradeNo));

  if (!recharge) {
    throw new Error(`[Wallet] Recharge not found: ${outTradeNo}`);
  }
  if (recharge.status === "paid") return; // 幂等
  if (recharge.userId !== userId) {
    throw new Error(`[Wallet] User mismatch for recharge: ${outTradeNo}, expected ${recharge.userId}, got ${userId}`);
  }

  // 在事务中完成：标记充值 → 更新余额 → 写流水
  db.transaction((tx) => {
    // 1. 标记充值已支付
    tx.update(walletRecharges)
      .set({
        status: "paid",
        providerSessionId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(walletRecharges.id, recharge.id))
      .run();

    // 2. 读当前余额（有则读，无则插）
    const balances = tx.select().from(walletBalance).where(eq(walletBalance.userId, userId)).all();
    const balanceBefore = balances.length > 0 ? balances[0].balance : 0;

    if (balances.length > 0) {
      tx.update(walletBalance)
        .set({
          balance: balanceBefore + amount,
          updatedAt: new Date(),
        })
        .where(eq(walletBalance.userId, userId))
        .run();
    } else {
      tx.insert(walletBalance)
        .values({ userId, balance: amount })
        .run();
    }

    const balanceAfter = balanceBefore + amount;

    // 3. 写入流水
    const [rechargeRow] = tx
      .select({ provider: walletRecharges.provider })
      .from(walletRecharges)
      .where(eq(walletRecharges.id, recharge.id))
      .all();
    const providerLabel = rechargeRow?.provider === "alipay" ? "Alipay" : "Stripe";

    tx.insert(walletRecords)
      .values({
        id: genId(),
        userId,
        type: "recharge",
        amount,
        balanceBefore,
        balanceAfter,
        description: `${providerLabel} ${(amount / 100).toFixed(2)} 充值`,
        referenceId: recharge.id,
        referenceType: "recharge",
      })
      .run();
  });
}

export async function spendFromWallet(input: SpendInput): Promise<{
  balanceBefore: number;
  balanceAfter: number;
}> {
  const { userId, amount, description, referenceId, referenceType } = input;

  return db.transaction((tx) => {
    const balances = tx.select().from(walletBalance).where(eq(walletBalance.userId, userId)).all();

    if (balances.length === 0 || balances[0].balance < amount) {
      throw new Error("余额不足");
    }

    const balanceBefore = balances[0].balance;
    const balanceAfter = balanceBefore - amount;

    tx.update(walletBalance)
      .set({ balance: balanceAfter, updatedAt: new Date() })
      .where(eq(walletBalance.userId, userId))
      .run();

    tx.insert(walletRecords)
      .values({
        id: genId(),
        userId,
        type: "spend",
        amount: -amount,
        balanceBefore,
        balanceAfter,
        description,
        referenceId: referenceId ?? null,
        referenceType: referenceType ?? null,
      })
      .run();

    return { balanceBefore, balanceAfter };
  });
}
