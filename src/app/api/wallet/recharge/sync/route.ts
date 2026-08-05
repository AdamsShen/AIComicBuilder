import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { walletRecharges } from "@/lib/db/schema";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { creditWalletRecharge } from "@/lib/wallet";
import { getUsdToCnyRate } from "@/lib/wallet-plans";

/**
 * POST /api/wallet/recharge/sync
 * 兜底同步接口：当 Stripe webhook 因本地开发环境无法触达时，
 * 直接查 Stripe 确认支付状态并完成入账。
 * 生产环境作为 webhook 延迟/丢失的补充保障。
 */
export async function POST(_request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // 找当前用户所有待支付且有 provider_session_id 的充值记录
  const pendingRecharges = await db
    .select()
    .from(walletRecharges)
    .where(
      and(
        eq(walletRecharges.userId, session.user.id),
        eq(walletRecharges.status, "pending"),
        isNotNull(walletRecharges.providerSessionId),
      ),
    )
    .all();

  let synced = 0;

  for (const recharge of pendingRecharges) {
    const sessionId = recharge.providerSessionId!;
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

      if (checkoutSession.payment_status === "paid") {
        // Stripe 收美元，按汇率转为人民币分入账
        const usdAmount = checkoutSession.amount_total ?? 0;
        const cnyAmount = Math.round(usdAmount * getUsdToCnyRate());

        await creditWalletRecharge({
          outTradeNo: recharge.outTradeNo,
          userId: recharge.userId,
          amount: cnyAmount,
          providerSessionId: sessionId,
        });
        synced++;
      }
    } catch (err) {
      // 单笔失败不阻塞其他同步，记录日志
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Recharge Sync] Failed for ${recharge.outTradeNo}:`, message);
    }
  }

  return NextResponse.json({ synced });
}
