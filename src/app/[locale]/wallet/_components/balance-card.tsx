"use client";

import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { centsToYuan } from "@/lib/wallet-plans";

interface BalanceCardProps {
  balance: number;
  onRecharge: () => void;
  loading: boolean;
}

export function BalanceCard({ balance, onRecharge, loading }: BalanceCardProps) {
  const t = useTranslations("wallet");

  return (
    <div className="rounded-2xl border border-[--border-subtle] bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--primary]/10">
              <Wallet className="h-4 w-4 text-[--primary]" />
            </div>
            <span className="text-sm font-medium text-[--text-secondary]">
              {t("balance")}
            </span>
          </div>
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[--surface]" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-[--text-primary]">
              ¥{centsToYuan(balance)}
            </p>
          )}
        </div>
        <Button onClick={onRecharge} size="sm" className="gap-1.5">
          <Wallet className="h-3.5 w-3.5" />
          {t("topUp")}
        </Button>
      </div>
    </div>
  );
}
