"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  title: string;
  amount: number | null;
  currency: string;
  interval: "month" | "year";
  statusLabel: string;
  statusColor: string;
  dateLabel: string;
  date: string | null;
  raw: StripeInfo | AlipayInfoItem;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

function formatAmount(amount: number, currency: string): string {
  const symbol = currency === "usd" ? "$" : "¥";
  return `${symbol}${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function buildBillingItems(
  stripe: StripeInfo | null,
  alipay: AlipayInfoItem[],
  t: ReturnType<typeof useTranslations<"billing">>,
): BillingItem[] {
  const items: BillingItem[] = [];

  if (stripe) {
    const now = Date.now();
    const periodEnd = new Date(stripe.currentPeriodEnd).getTime();
    const isActive = ["active", "trialing"].includes(stripe.status) && periodEnd > now;

    const titleKey =
      stripe.interval === "year" ? "subscription.withYearly" : "subscription.withMonthly";

    items.push({
      id: `stripe-${stripe.id}`,
      type: "stripe",
      title: t(titleKey as any),
      amount: stripe.amount,
      currency: stripe.currency || "USD",
      interval: stripe.interval,
      statusLabel: isActive
        ? t("status.active")
        : stripe.status === "canceled"
          ? t("status.canceled")
          : t(`status.${stripe.status}` as any),
      statusColor: isActive
        ? "text-green-600"
        : stripe.status === "canceled"
          ? "text-gray-400"
          : "text-amber-600",
      dateLabel: isActive
        ? t("dateLabel.expires")
        : stripe.canceledAt
          ? t("dateLabel.canceledAt")
          : t("dateLabel.createdAt"),
      date: isActive ? stripe.currentPeriodEnd : stripe.canceledAt || stripe.createdAt,
      raw: stripe,
    });
  }

  for (const order of alipay) {
    const isActive = order.periodEnd ? new Date(order.periodEnd).getTime() > Date.now() : false;
    const titleKey =
      order.interval === "year" ? "subscription.alipayYearly" : "subscription.alipayMonthly";

    items.push({
      id: `alipay-${order.outTradeNo}`,
      type: "alipay",
      title: t(titleKey as any),
      amount: order.amount,
      currency: "CNY",
      interval: order.interval,
      statusLabel: isActive ? t("status.active") : t("status.expired"),
      statusColor: isActive ? "text-green-600" : "text-gray-400",
      dateLabel: isActive ? t("dateLabel.expires") : t("dateLabel.paidAt"),
      date: isActive ? order.periodEnd : order.paidAt,
      raw: order,
    });
  }

  items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  return items;
}

function DetailSheet({
  item,
  onClose,
  onStripePortal,
  portalLoading,
  t,
  locale,
}: {
  item: BillingItem;
  onClose: () => void;
  onStripePortal: () => void;
  portalLoading: boolean;
  t: ReturnType<typeof useTranslations<"billing">>;
  locale: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-[--border-subtle] px-5 py-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">{t("detailTitle")}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[--text-muted] hover:bg-[--surface]"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-[--text-muted]">
              {item.type === "stripe" ? t("stripeLabel") : t("alipayLabel")}
            </p>
            <p className="text-lg font-semibold text-[--text-primary] mt-0.5">{item.title}</p>
          </div>

          <div className="border-t border-[--border-subtle]" />

          {item.type === "stripe" ? (
            <StripeDetail raw={item.raw as StripeInfo} t={t} locale={locale} />
          ) : (
            <AlipayDetail raw={item.raw as AlipayInfoItem} t={t} locale={locale} />
          )}

          {item.type === "stripe" && (
            <div className="pt-2">
              <button
                onClick={onStripePortal}
                disabled={portalLoading}
                className="w-full h-10 rounded-xl bg-[#635BFF] text-white text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {portalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("stripePortal")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StripeDetail({
  raw,
  t,
  locale,
}: {
  raw: StripeInfo;
  t: ReturnType<typeof useTranslations<"billing">>;
  locale: string;
}) {
  const statusMap: Record<string, string> = {
    active: t("status.active"),
    trialing: t("status.trialing"),
    past_due: t("status.past_due"),
    canceled: t("status.canceled"),
    incomplete: t("status.incomplete"),
    incomplete_expired: t("status.incomplete_expired"),
    unpaid: t("status.unpaid"),
  };

  return (
    <div className="space-y-3">
      <Row label={t("detail.subscriptionId")} value={raw.id} mono />
      <Row label={t("detail.status")} value={statusMap[raw.status] || raw.status} />
      <Row
        label={t("detail.interval")}
        value={t(`interval.${raw.interval}` as any)}
      />
      <Row label={t("detail.periodStart")} value={formatDate(raw.currentPeriodStart, locale)} />
      <Row label={t("detail.periodEnd")} value={formatDate(raw.currentPeriodEnd, locale)} />
      {raw.cancelAtPeriodEnd && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          {t("detail.cancelNotice")}
        </div>
      )}
      {raw.canceledAt && <Row label={t("detail.canceledAt")} value={formatDateTime(raw.canceledAt, locale)} />}
      <Row label={t("detail.createdAt")} value={formatDateTime(raw.createdAt, locale)} />
    </div>
  );
}

function AlipayDetail({
  raw,
  t,
  locale,
}: {
  raw: AlipayInfoItem;
  t: ReturnType<typeof useTranslations<"billing">>;
  locale: string;
}) {
  return (
    <div className="space-y-3">
      <Row label={t("detail.orderNo")} value={raw.outTradeNo} mono />
      {raw.alipayTradeNo && <Row label={t("detail.alipayTradeNo")} value={raw.alipayTradeNo} mono />}
      <Row label={t("detail.amount")} value={formatAmount(raw.amount, "cny")} />
      <Row
        label={t("detail.interval")}
        value={t(`interval.${raw.interval}` as any)}
      />
      <Row label={t("detail.startTime")} value={formatDateTime(raw.periodStart, locale)} />
      <Row label={t("detail.endTime")} value={formatDateTime(raw.periodEnd, locale)} />
      <Row label={t("detail.payTime")} value={formatDateTime(raw.paidAt, locale)} />
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
  const params = useParams();
  const locale = (params?.locale as string) ?? "zh";
  const t = useTranslations("billing");
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BillingItem | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/billing");
        if (!res.ok) throw new Error(t("loading"));
        const data = await res.json();
        setItems(buildBillingItems(data.stripe, data.alipay, t));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("loading"));
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
        <button className="text-sm text-[--primary]" onClick={() => router.back()}>
          {t("back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-[--border-subtle] bg-white/80 backdrop-blur-xl px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="font-display text-sm font-semibold text-[--text-primary]">
            {t("title")}
          </span>
        </div>
      </header>

      <main className="flex-1 bg-[--surface]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CreditCard className="h-10 w-10 text-[--text-muted]" />
            <p className="text-sm text-[--text-muted]">{t("empty")}</p>
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
                      {item.dateLabel} {formatDate(item.date, locale)}
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

      {selected && (
        <DetailSheet
          item={selected}
          onClose={() => setSelected(null)}
          onStripePortal={handleStripePortal}
          portalLoading={portalLoading}
          t={t}
          locale={locale}
        />
      )}
    </div>
  );
}
