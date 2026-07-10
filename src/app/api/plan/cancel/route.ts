import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 取消当前套餐选择：把 users.plan 清空为 null。
 * 之后该用户不再拥有套餐（门槛 requirePlan 不通过）→ 会被引导回定价页重新选择/购买 Pro。
 * 注：Pro 会员由订阅派生，不受此影响；此接口用于免费用户放弃 free 以回到购买界面。
 * 响应：{ ok: true }
 */
export async function POST() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    await db
      .update(users)
      .set({ plan: null, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Plan Cancel] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
