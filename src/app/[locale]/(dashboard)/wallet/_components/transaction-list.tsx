"use client";

import { useTranslations } from "next-intl";
import { TransactionRow } from "./transaction-row";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Record {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface TransactionListProps {
  records: Record[];
  hasMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
}

export function TransactionList({ records, hasMore, onLoadMore, loading }: TransactionListProps) {
  const t = useTranslations("wallet");

  if (loading && records.length === 0) {
    return (
      <div className="mt-6 space-y-1">
        <h3 className="text-sm font-semibold text-[--text-primary] mb-3">
          {t("transactionHistory")}
        </h3>
        <div className="rounded-2xl border border-[--border-subtle] bg-white divide-y divide-[--border-subtle]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-20 bg-[--surface] rounded" />
                <div className="h-3 w-28 bg-[--surface] rounded" />
              </div>
              <div className="h-3 w-16 bg-[--surface] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-1">
      <h3 className="text-sm font-semibold text-[--text-primary] mb-3">
        {t("transactionHistory")}
      </h3>
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[--border-subtle] bg-white py-16">
          <p className="text-sm text-[--text-muted]">{t("noTransactions")}</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[--border-subtle] bg-white divide-y divide-[--border-subtle]">
            {records.map((r) => (
              <TransactionRow
                key={r.id}
                type={r.type}
                amount={r.amount}
                description={r.description}
                createdAt={r.createdAt}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="mt-3 w-full rounded-xl border border-[--border-subtle] bg-white py-2.5 text-xs font-medium text-[--text-secondary] hover:bg-[--surface] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-[--text-muted] border-t-transparent" />
                  {t("loadMore")}
                </span>
              ) : (
                t("loadMore")
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
