import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { alipayOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAlipaySdk } from "@/lib/alipay";
import { reconcileOrder } from "@/lib/alipay/reconcile";

const SUCCESS_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

/**
 * 主动查单兜底：向支付宝查询订单真实状态，若已付则落库。
 * 用于本地无公网 notify、或用户支付后回跳时立即确认会员状态。
 * 请求体：{ outTradeNo: string }
 * 响应：{ status: "pending" | "paid" | "closed", periodEnd: string | null }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { outTradeNo } = (await request.json()) as { outTradeNo: string };
  if (!outTradeNo) {
    return NextResponse.json({ error: "缺少订单号" }, { status: 400 });
  }

  try {
    const [order] = await db
      .select()
      .from(alipayOrders)
      .where(eq(alipayOrders.outTradeNo, outTradeNo))
      .limit(1);

    // 订单不存在或不属于当前用户，一律不泄露详情
    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    // 已付款则直接返回，无需再查支付宝
    if (order.status !== "paid") {
      const result = (await getAlipaySdk().exec("alipay.trade.query", {
        bizContent: { out_trade_no: outTradeNo },
      })) as Record<string, string>;

      if (result.code === "10000" && SUCCESS_STATUSES.has(result.trade_status)) {
        await reconcileOrder({
          outTradeNo,
          alipayTradeNo: result.trade_no,
          totalAmount: result.total_amount,
        });
      }
    }

    // 重新读取最新状态返回
    const [fresh] = await db
      .select()
      .from(alipayOrders)
      .where(eq(alipayOrders.outTradeNo, outTradeNo))
      .limit(1);

    return NextResponse.json({
      status: fresh.status,
      periodEnd: fresh.periodEnd ? fresh.periodEnd.toISOString() : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Alipay Query] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
