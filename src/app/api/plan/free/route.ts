import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 选择免费套餐：将当前登录用户标记为 free。
 * 未登录不可调用（对应「未登录不可订阅 free/pro」）。
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
      .set({ plan: "free", updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Plan Free] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
