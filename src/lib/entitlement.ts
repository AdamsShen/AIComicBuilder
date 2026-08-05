import { db } from "@/lib/db";
import { users, walletBalance } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** 试用期天数，环境变量 TRIAL_DURATION_DAYS 控制，默认 3 天 */
export function getTrialDurationDays(): number {
  const env = process.env.TRIAL_DURATION_DAYS;
  if (env) {
    const parsed = Number(env);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3;
}

/** 用户是否在试用期内（注册后 N 天内免费使用所有功能） */
export async function isInTrial(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ trialEndsAt: users.trialEndsAt, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;

  // 自动补偿：trialEndsAt 为 null 时用 createdAt 计算并回写
  let endsAt = user.trialEndsAt;
  if (!endsAt) {
    const trialDays = getTrialDurationDays();
    endsAt = new Date(user.createdAt.getTime() + trialDays * 86_400_000);
    try {
      db.update(users)
        .set({ trialEndsAt: endsAt })
        .where(eq(users.id, userId))
        .run();
    } catch {
      // 回写失败不阻塞
    }
  }

  return new Date() < endsAt;
}

/** 获取用户钱包余额（单位：人民币分）；无记录返回 0 */
export async function getBalance(userId: string): Promise<number> {
  const rows = await db
    .select({ balance: walletBalance.balance })
    .from(walletBalance)
    .where(eq(walletBalance.userId, userId))
    .limit(1);

  return rows.length > 0 ? rows[0].balance : 0;
}

/** 用户是否可以使用 AI 功能（试用期内 或 余额 > 0） */
export async function canUseAI(userId: string): Promise<boolean> {
  if (await isInTrial(userId)) return true;
  const balance = await getBalance(userId);
  return balance > 0;
}

/** 获取用户试用剩余描述（天/已到期） */
export async function getTrialStatus(userId: string): Promise<{
  inTrial: boolean;
  expired: boolean;
  daysLeft: number;
  endsAt: Date | null;
}> {
  const [user] = await db
    .select({ trialEndsAt: users.trialEndsAt, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { inTrial: false, expired: false, daysLeft: 0, endsAt: null };
  }

  // 自动补偿：trialEndsAt 为 null 时用 createdAt 计算并回写
  let endsAt = user.trialEndsAt;
  if (!endsAt) {
    const trialDays = getTrialDurationDays();
    endsAt = new Date(user.createdAt.getTime() + trialDays * 86_400_000);
    try {
      db.update(users)
        .set({ trialEndsAt: endsAt })
        .where(eq(users.id, userId))
        .run();
    } catch {
      // 回写失败不阻塞
    }
  }

  const now = Date.now();
  const endsMs = endsAt.getTime();
  const inTrial = now < endsMs;
  const diff = endsMs - now;
  const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  return {
    inTrial,
    expired: !inTrial,
    daysLeft,
    endsAt,
  };
}

/**
 * 用户是否已注册并登录（最基本的门控）。
 * 新注册用户自动拥有试用期，老用户若已过期则需充值。
 */
export async function hasActivePlan(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return !!user;
}
