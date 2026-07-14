import { getAlipaySdk } from "@/lib/alipay";
import { creditWalletRecharge } from "@/lib/wallet";
import { db } from "@/lib/db";
import { walletRecharges } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SUCCESS_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  try {
    if (!getAlipaySdk().checkNotifySign(params)) {
      console.error("[Wallet Alipay Notify] signature verification failed");
      return new Response("failure", { status: 200 });
    }

    const tradeStatus = params.trade_status;
    if (SUCCESS_STATUSES.has(tradeStatus)) {
      if (!params.out_trade_no || !params.total_amount) {
        console.error(
          "[Wallet Alipay Notify] missing out_trade_no/total_amount in payload",
        );
        return new Response("failure", { status: 200 });
      }

      const [recharge] = await db
        .select()
        .from(walletRecharges)
        .where(eq(walletRecharges.outTradeNo, params.out_trade_no));

      if (!recharge) {
        console.error(
          `[Wallet Alipay Notify] recharge not found: ${params.out_trade_no}`,
        );
        return new Response("success", { status: 200 });
      }

      if (recharge.status !== "paid") {
        // 金额校验
        const alipayAmount = Math.round(Number(params.total_amount) * 100);
        if (alipayAmount !== recharge.amount) {
          console.error(
            `[Wallet Alipay Notify] amount mismatch: expected ${recharge.amount}, got ${alipayAmount}`,
          );
          return new Response("success", { status: 200 });
        }

        await creditWalletRecharge({
          outTradeNo: params.out_trade_no,
          userId: recharge.userId,
          amount: recharge.amount,
          providerSessionId: params.trade_no,
        });
      }
    }

    return new Response("success", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Wallet Alipay Notify] Error:", message);
    return new Response("failure", { status: 500 });
  }
}
