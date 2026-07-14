import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { walletBalance, walletRecords } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const balances = await db
    .select()
    .from(walletBalance)
    .where(eq(walletBalance.userId, session.user.id));

  const balance = balances.length > 0 ? balances[0].balance : 0;

  const records = await db
    .select()
    .from(walletRecords)
    .where(eq(walletRecords.userId, session.user.id))
    .orderBy(desc(walletRecords.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ balance, records });
}
