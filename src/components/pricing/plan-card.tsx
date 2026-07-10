"use client";

import { useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";
import { SubscribeButton } from "./subscribe-button";
import { AlipayButton } from "./alipay-button";
import { FreePlanButton } from "./free-plan-button";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { useState } from "react";
import { PLANS } from "@/lib/plans";
import type { BillingInterval } from "./pricing-header";

interface PlanCardProps {
  plan: (typeof PLANS)[keyof typeof PLANS] & { key: string };
  interval: BillingInterval;
  isLoggedIn: boolean;
}

export function PlanCard({ plan, interval, isLoggedIn }: PlanCardProps) {
  const t = useTranslations("pricing");
  const [showSignIn, setShowSignIn] = useState(false);

  const price =
    interval === "year" ? plan.priceYearly : plan.priceMonthly;
  const priceId =
    interval === "year" ? plan.priceIdYearly : plan.priceIdMonthly;
  const isFree = price === 0;

  return (
    <>
      <div
        className={`relative rounded-2xl border p-8 ${
          plan.highlight
            ? "border-[--primary]/20 bg-gradient-to-b from-[--primary]/5 to-white shadow-lg shadow-[--primary]/5"
            : "border-[--border-subtle] bg-white"
        }`}
      >
        {plan.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[--primary] px-3 py-1 text-[11px] font-medium text-white shadow-sm">
              <Sparkles className="h-3 w-3" />
              {t("popular")}
            </span>
          </div>
        )}

        <div className="text-center mb-8">
          <h3 className="font-display text-xl font-semibold text-[--text-primary] mb-2">
            {t(plan.nameKey)}
          </h3>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-[--text-primary]">
              {isFree ? t("freePrice") : `$${price}`}
            </span>
            {!isFree && (
              <span className="text-sm text-[--text-muted]">
                /{t(interval === "month" ? "perMonth" : "perYear")}
              </span>
            )}
          </div>
          {!isFree && interval === "year" && (
            <p className="text-xs text-[--text-muted] mt-1">
              ${(price / 12).toFixed(1)}/mo {t("billedAnnually")}
            </p>
          )}
        </div>

        <ul className="space-y-3 mb-8">
          {plan.features.map((featureKey) => (
            <li key={featureKey} className="flex items-start gap-3">
              <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-500" />
              <span className="text-sm text-[--text-secondary]">
                {t(featureKey)}
              </span>
            </li>
          ))}
        </ul>

        <div className="text-center">
          {isFree ? (
            isLoggedIn ? (
              <FreePlanButton />
            ) : (
              <button
                onClick={() => setShowSignIn(true)}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[--border-subtle] bg-white text-sm font-medium text-[--text-primary] transition-colors hover:bg-[--surface]"
              >
                {t(plan.cta)}
              </button>
            )
          ) : isLoggedIn ? (
            <div className="space-y-2.5">
              <SubscribeButton priceId={priceId!} interval={interval} />
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-[--border-subtle]" />
                <span className="text-[11px] text-[--text-muted]">
                  {t("or")}
                </span>
                <span className="h-px flex-1 bg-[--border-subtle]" />
              </div>
              <AlipayButton interval={interval} />
            </div>
          ) : (
            <button
              onClick={() => setShowSignIn(true)}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[--primary] text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t(plan.cta)}
            </button>
          )}
        </div>
      </div>
      <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
    </>
  );
}
