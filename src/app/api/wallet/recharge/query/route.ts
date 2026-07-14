import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { walletRecharges, walletBalance } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let outTradeNo: string;
  try {
    const body = (await request.json()) as { outTradeNo: string };
    outTradeNo = body.outTradeNo;
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const [recharge] = await db
    .select()
    .from(walletRecharges)
    .where(eq(walletRecharges.outTradeNo, outTradeNo));

  if (!recharge || recharge.userId !== session.user.id) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  const balances = await db
    .select()
    .from(walletBalance)
    .where(eq(walletBalance.userId, session.user.id));

  return NextResponse.json({
    status: recharge.status,
    balance: balances.length > 0 ? balances[0].balance : 0,
  });
}
