"use client";

import { useTranslations } from "next-intl";
import type { BillingInterval } from "./pricing-header";

interface IntervalToggleProps {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}

export function IntervalToggle({ value, onChange }: IntervalToggleProps) {
  const t = useTranslations("pricing");

  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-[--surface] p-1">
      <button
        onClick={() => onChange("month")}
        className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
          value === "month"
            ? "bg-white text-[--text-primary] shadow-sm"
            : "text-[--text-muted] hover:text-[--text-secondary]"
        }`}
      >
        {t("monthly")}
      </button>
      <button
        onClick={() => onChange("year")}
        className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
          value === "year"
            ? "bg-white text-[--text-primary] shadow-sm"
            : "text-[--text-muted] hover:text-[--text-secondary]"
        }`}
      >
        {t("yearly")}
        <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
          {t("savePercent", { percent: "17" })}
        </span>
      </button>
    </div>
  );
}
