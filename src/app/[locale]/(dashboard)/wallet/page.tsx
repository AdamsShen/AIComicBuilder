"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { BalanceCard } from "./_components/balance-card";
import { TransactionList } from "./_components/transaction-list";
import { RechargeDialog } from "./_components/recharge-dialog";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const recharge = searchParams.get("recharge");
    if (recharge === "success") {
      // 先调用 sync 兜底接口同步 Stripe 支付状态，再刷新钱包数据
      fetch("/api/wallet/recharge/sync", { method: "POST" })
        .catch(() => {})
        .finally(() => fetchData());
    }
  }, [searchParams]);

  function handleLoadMore() {
    setLoadingMore(true);
    fetchData(true).finally(() => setLoadingMore(false));
  }

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-6">
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
      </div>

      {/* Recharge dialog */}
      <RechargeDialog open={showRecharge} onOpenChange={setShowRecharge} />
    </>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletPageInner />
    </Suspense>
  );
}
