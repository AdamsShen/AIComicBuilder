"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, ChevronRight, Loader2, AlertCircle } from "lucide-react";

interface StripeInfo {
  id: string;
  status: string;
  interval: "month" | "year";
  priceId: string;
  amount: number | null;
  currency: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
}

interface AlipayInfoItem {
  outTradeNo: string;
  alipayTradeNo: string | null;
  interval: "month" | "year";
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
}

interface BillingItem {
  id: string;
  type: "stripe" | "alipay";
  /** 显示标题 */
  title: string;
  /** 金额（分），alipay 直接有，stripe 无直接金额展示为 null */
  amount: number | null;
  /** 金额单位 */
  currency: string;
  /** 周期 */
  interval: "month" | "year";
  /** 状态标签 */
  statusLabel: string;
  statusColor: string;
  /** 展示日期 */
  dateLabel: string;
  date: string | null;
  /** 原始数据，供详情弹窗 */
  raw: StripeInfo | AlipayInfoItem;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === "usd" ? "$" : "¥";
  return `${symbol}${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function intervalLabel(interval: "month" | "year"): string {
  return interval === "year" ? "年" : "月";
}

function buildBillingItems(stripe: StripeInfo | null, alipay: AlipayInfoItem[]): BillingItem[] {
  const items: BillingItem[] = [];

  if (stripe) {
    const now = Date.now();
    const periodEnd = new Date(stripe.currentPeriodEnd).getTime();
    const isActive = ["active", "trialing"].includes(stripe.status) && periodEnd > now;

    items.push({
      id: `stripe-${stripe.id}`,
      type: "stripe",
      title: `Stripe 订阅 · ${intervalLabel(stripe.interval)}付`,
      amount: stripe.amount,
      currency: stripe.currency || "USD",
      interval: stripe.interval,
      statusLabel: isActive ? "有效" : stripe.status === "canceled" ? "已取消" : stripe.status,
      statusColor: isActive ? "text-green-600" : stripe.status === "canceled" ? "text-gray-400" : "text-amber-600",
      dateLabel: isActive ? "到期" : stripe.canceledAt ? "取消于" : "创建于",
      date: isActive ? stripe.currentPeriodEnd : stripe.canceledAt || stripe.createdAt,
      raw: stripe,
    });
  }

  for (const order of alipay) {
    const isActive = order.periodEnd ? new Date(order.periodEnd).getTime() > Date.now() : false;
    items.push({
      id: `alipay-${order.outTradeNo}`,
      type: "alipay",
      title: `支付宝 · ${intervalLabel(order.interval)}付会员`,
      amount: order.amount,
      currency: "CNY",
      interval: order.interval,
      statusLabel: isActive ? "有效" : "已过期",
      statusColor: isActive ? "text-green-600" : "text-gray-400",
      dateLabel: isActive ? "到期" : "支付于",
      date: isActive ? order.periodEnd : order.paidAt,
      raw: order,
    });
  }

  // 按日期倒序
  items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return items;
}

/** 详情弹窗 */
function DetailSheet({
  item,
  onClose,
  onStripePortal,
  portalLoading,
}: {
  item: BillingItem;
  onClose: () => void;
  onStripePortal: () => void;
  portalLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/20" />
      {/* sheet */}
      <div
        className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-[--border-subtle] px-5 py-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">账单详情</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[--text-muted] hover:bg-[--surface]"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 标题行 */}
          <div>
            <p className="text-xs text-[--text-muted]">
              {item.type === "stripe" ? "Stripe 订阅" : "支付宝"}
            </p>
            <p className="text-lg font-semibold text-[--text-primary] mt-0.5">
              {item.title}
            </p>
          </div>

          <div className="border-t border-[--border-subtle]" />

          {item.type === "stripe" ? (
            <StripeDetail raw={item.raw as StripeInfo} />
          ) : (
            <AlipayDetail raw={item.raw as AlipayInfoItem} />
          )}

          {item.type === "stripe" && (
            <div className="pt-2">
              <button
                onClick={onStripePortal}
                disabled={portalLoading}
                className="w-full h-10 rounded-xl bg-[#635BFF] text-white text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {portalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                管理订阅（Stripe 门户）
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StripeDetail({ raw }: { raw: StripeInfo }) {
  const statusMap: Record<string, string> = {
    active: "有效",
    trialing: "试用中",
    past_due: "逾期",
    canceled: "已取消",
    incomplete: "未完成",
    incomplete_expired: "已过期",
    unpaid: "未支付",
  };

  return (
    <div className="space-y-3">
      <Row label="订阅 ID" value={raw.id} mono />
      <Row label="状态" value={statusMap[raw.status] || raw.status} />
      <Row label="周期" value={intervalLabel(raw.interval) + "付"} />
      <Row label="当前周期开始" value={formatDate(raw.currentPeriodStart)} />
      <Row label="当前周期结束" value={formatDate(raw.currentPeriodEnd)} />
      {raw.cancelAtPeriodEnd && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          订阅将于当前周期结束后取消
        </div>
      )}
      {raw.canceledAt && <Row label="取消时间" value={formatDateTime(raw.canceledAt)} />}
      <Row label="创建时间" value={formatDateTime(raw.createdAt)} />
    </div>
  );
}

function AlipayDetail({ raw }: { raw: AlipayInfoItem }) {
  return (
    <div className="space-y-3">
      <Row label="订单号" value={raw.outTradeNo} mono />
      {raw.alipayTradeNo && <Row label="支付宝交易号" value={raw.alipayTradeNo} mono />}
      <Row label="金额" value={formatAmount(raw.amount, "cny")} />
      <Row label="周期" value={intervalLabel(raw.interval) + "付"} />
      <Row label="开始时间" value={formatDateTime(raw.periodStart)} />
      <Row label="到期时间" value={formatDateTime(raw.periodEnd)} />
      <Row label="支付时间" value={formatDateTime(raw.paidAt)} />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[--text-muted] shrink-0">{label}</span>
      <span
        className={`text-[--text-primary] text-right ml-4 truncate max-w-[220px] ${mono ? "font-mono text-[11px] text-[--text-muted]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BillingItem | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/billing");
        if (!res.ok) throw new Error("获取账单信息失败");
        const data = await res.json();
        setItems(buildBillingItems(data.stripe, data.alipay));
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleStripePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[--text-muted]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-[--text-muted]" />
        <p className="text-sm text-[--text-muted]">{error}</p>
        <button
          className="text-sm text-[--primary]"
          onClick={() => router.back()}
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-[--border-subtle] bg-white/80 backdrop-blur-xl px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-display text-sm font-semibold text-[--text-primary]">
            账单管理
          </span>
        </div>
      </header>

      <main className="flex-1 bg-[--surface]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CreditCard className="h-10 w-10 text-[--text-muted]" />
            <p className="text-sm text-[--text-muted]">暂无账单记录</p>
          </div>
        ) : (
          <div className="divide-y divide-[--border-subtle]">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-[--surface]/60 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[--text-primary] truncate">
                      {item.title}
                    </span>
                    <span className={`text-[11px] font-medium shrink-0 ${item.statusColor}`}>
                      {item.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[--text-muted]">
                    <span>
                      {item.dateLabel} {formatDate(item.date)}
                    </span>
                    {item.amount != null && (
                      <span className="text-[--text-primary] font-medium">
                        {formatAmount(item.amount, item.currency)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[--text-muted] shrink-0 ml-3" />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* 详情侧边弹窗 */}
      {selected && (
        <DetailSheet
          item={selected}
          onClose={() => setSelected(null)}
          onStripePortal={handleStripePortal}
          portalLoading={portalLoading}
        />
      )}
    </div>
  );
}
