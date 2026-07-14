import { NextResponse } from "next/server";
import { getAlipaySdk } from "@/lib/alipay";
import { creditWalletRecharge } from "@/lib/wallet";
import { db } from "@/lib/db";
import { walletRecharges } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SUCCESS_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const outTradeNo = url.searchParams.get("out_trade_no");

  try {
    if (outTradeNo) {
      const result = (await getAlipaySdk().exec("alipay.trade.query", {
        bizContent: { out_trade_no: outTradeNo },
      })) as Record<string, string>;

      if (
        result.code === "10000" &&
        SUCCESS_STATUSES.has(result.trade_status)
      ) {
        const [recharge] = await db
          .select()
          .from(walletRecharges)
          .where(eq(walletRecharges.outTradeNo, outTradeNo));

        if (recharge && recharge.status !== "paid") {
          await creditWalletRecharge({
            outTradeNo,
            userId: recharge.userId,
            amount: recharge.amount,
            providerSessionId: result.trade_no,
          });
        }
      }
    }
  } catch (err) {
    console.error(
      "[Wallet Alipay Return] Error:",
      err instanceof Error ? err.message : String(err),
    );
  }

  return NextResponse.redirect(
    new URL(
      "/wallet?recharge=success&provider=alipay",
      process.env.BETTER_AUTH_URL || request.url,
    ),
  );
}
