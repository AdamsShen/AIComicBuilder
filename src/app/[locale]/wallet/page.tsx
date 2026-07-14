"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { BalanceCard } from "./_components/balance-card";
import { TransactionList } from "./_components/transaction-list";
import { RechargeDialog } from "./_components/recharge-dialog";
import { CheckoutSuccessToast } from "@/components/pricing/checkout-success-toast";
import { Suspense } from "react";

interface WalletRecord {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  records: WalletRecord[];
}

const PAGE_SIZE = 20;

function WalletPageInner() {
  const t = useTranslations("wallet");
  const searchParams = useSearchParams();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showRecharge, setShowRecharge] = useState(false);

  const fetchData = useCallback(async (append?: boolean) => {
    const offset = append ? (data?.records.length ?? 0) : 0;
    try {
      const res = await fetch(`/api/wallet?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) return;
      const json = (await res.json()) as WalletData;
      if (append && data) {
        setData({
          balance: json.balance,
          records: [...data.records, ...json.records],
        });
        setHasMore(json.records.length >= PAGE_SIZE);
      } else {
        setData(json);
        setHasMore(json.records.length >= PAGE_SIZE);
      }
    } catch {
      // ignore
    }
  }, [data?.records.length]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    // fetchData 引用稳定（只依赖 data.records.length，初始化时只调一次）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const recharge = searchParams.get("recharge");
    if (recharge === "success") {
      fetchData();
    }
  }, [searchParams]);

  function handleLoadMore() {
    setLoadingMore(true);
    fetchData(true).finally(() => setLoadingMore(false));
  }

  return (
    <div className="animate-page-in mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--primary]/10">
          <svg
            className="h-4 w-4 text-[--primary]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight text-[--text-primary]">
          {t("title")}
        </h2>
      </div>

      {/* Balance card */}
      <BalanceCard
        balance={data?.balance ?? 0}
        onRecharge={() => setShowRecharge(true)}
        loading={loading}
      />

      {/* Transaction list */}
      <TransactionList
        records={data?.records ?? []}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        loading={loadingMore}
      />

      {/* Recharge dialog */}
      <RechargeDialog open={showRecharge} onOpenChange={setShowRecharge} />
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessToast />
      <WalletPageInner />
    </Suspense>
  );
}
