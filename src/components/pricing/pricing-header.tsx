"use client";

import { useTranslations } from "next-intl";

export type BillingInterval = "month" | "year";

export function PricingHeader() {
  const t = useTranslations("pricing");

  return (
    <div className="text-center mb-12">
      <h1 className="font-display text-4xl sm:text-5xl text-[--text-primary] mb-4">
        {t("title")}
      </h1>
      <p className="text-[--text-secondary] text-lg max-w-xl mx-auto">
        {t("subtitle")}
      </p>
    </div>
  );
}
