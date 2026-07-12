import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getMembership } from "@/lib/entitlement";

/**
 * 当前登录用户的套餐状态（供用户菜单决定显示"账单管理"、"会员到期"还是"取消订阅"）。
 * 响应：{ plan: "free" | "pro" | null, isPro: boolean, source: "stripe" | "alipay" | null }
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const [row] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const membership = await getMembership(session.user.id);
  return NextResponse.json({
    plan: row?.plan ?? null,
    isPro: membership.isPro,
    source: membership.source,
  });
}
