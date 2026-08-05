import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getTrialStatus, getBalance } from "@/lib/entitlement";

/**
 * GET /api/user/status
 * 返回当前用户的试用状态和钱包余额，供客户端组件使用。
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [trial, balance] = await Promise.all([
    getTrialStatus(session.user.id),
    getBalance(session.user.id),
  ]);

  return NextResponse.json({
    trial,
    balance, // 人民币分
  });
}
