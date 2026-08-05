"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STRIPE_TOPUP_AMOUNTS, ALIPAY_TOPUP_AMOUNTS, centsToYuan } from "@/lib/wallet-plans";

interface RechargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Provider = "stripe" | "alipay";

export function RechargeDialog({ open, onOpenChange }: RechargeDialogProps) {
  const t = useTranslations("wallet");
  const [provider, setProvider] = useState<Provider>("stripe");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(STRIPE_TOPUP_AMOUNTS[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amounts = provider === "stripe" ? STRIPE_TOPUP_AMOUNTS : ALIPAY_TOPUP_AMOUNTS;
  const finalAmount = selectedAmount ?? (customAmount ? Number(customAmount) * 100 : null);

  function displayAmount(amtCents: number): string {
    if (provider === "stripe") return `$${centsToYuan(amtCents)}`;
    return `¥${centsToYuan(amtCents)}`;
  }

  function displayFinalLabel(): string {
    if (!finalAmount) return "0.00";
    return displayAmount(finalAmount);
  }

  async function handleSubmit() {
    if (!finalAmount || finalAmount <= 0 || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/wallet/recharge/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  }

  function handleCustomInput(value: string) {
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setCustomAmount(value);
      setSelectedAmount(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recharge")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* Payment method selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[--text-secondary]">
              {t("selectPayment")}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { setProvider("stripe"); setSelectedAmount(STRIPE_TOPUP_AMOUNTS[0]); setCustomAmount(""); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  provider === "stripe"
                    ? "border-[--primary] bg-[--primary]/5 text-[--primary]"
                    : "border-[--border-subtle] text-[--text-secondary] hover:bg-[--surface]"
                }`}
              >
                {t("paymentStripe")}
              </button>
              <button
                onClick={() => { setProvider("alipay"); setSelectedAmount(ALIPAY_TOPUP_AMOUNTS[0]); setCustomAmount(""); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  provider === "alipay"
                    ? "border-[--primary] bg-[--primary]/5 text-[--primary]"
                    : "border-[--border-subtle] text-[--text-secondary] hover:bg-[--surface]"
                }`}
              >
                {t("paymentAlipay")}
              </button>
            </div>
          </div>

          {/* Amount selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[--text-secondary]">
              {t("selectAmount")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {amounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    selectedAmount === amt
                      ? "border-[--primary] bg-[--primary]/10 text-[--primary] shadow-sm ring-1 ring-[--primary]/20"
                      : "border-[--border-subtle] text-[--text-secondary] hover:bg-[--surface]"
                  }`}
                >
                  {displayAmount(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[--text-secondary]">
              {t("customAmount")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[--text-muted]">
                {provider === "stripe" ? "$" : "¥"}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={customAmount}
                onChange={(e) => handleCustomInput(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[--border-subtle] bg-white py-2 pl-7 pr-3 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--primary] focus:outline-none focus:ring-1 focus:ring-[--primary]/20"
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!finalAmount || finalAmount <= 0 || submitting}
            className="w-full"
            size="sm"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t("recharge")}
              </span>
            ) : (
              `${t("recharge")} ${displayFinalLabel()}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
