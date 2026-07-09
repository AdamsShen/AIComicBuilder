"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IntervalToggle } from "./interval-toggle";

export type BillingInterval = "month" | "year";

export function PricingHeader() {
  const t = useTranslations("pricing");
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <div className="text-center mb-16">
      <h1 className="font-display text-4xl sm:text-5xl text-[--text-primary] mb-4">
        {t("title")}
      </h1>
      <p className="text-[--text-secondary] text-lg max-w-xl mx-auto mb-8">
        {t("subtitle")}
      </p>
      <IntervalToggle value={interval} onChange={setInterval} />
    </div>
  );
}
