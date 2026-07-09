"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_KEYS = ["q1", "q2", "q3"] as const;

function FAQItem({ index }: { index: number }) {
  const t = useTranslations("pricing.faq");
  const [open, setOpen] = useState(false);
  const num = index + 1;

  return (
    <div className="border-b border-[--border-subtle] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-sm font-medium text-[--text-primary]">
          {t(`q${num}`)}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-[--text-muted] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="pb-4 pr-8">
          <p className="text-sm text-[--text-secondary] leading-relaxed">
            {t(`a${num}`)}
          </p>
        </div>
      )}
    </div>
  );
}

export function FAQSection() {
  const t = useTranslations("pricing.faq");

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="font-display text-2xl text-[--text-primary] text-center mb-8">
        {t("title")}
      </h2>
      <div className="rounded-2xl border border-[--border-subtle] bg-white px-6">
        {FAQ_KEYS.map((_, i) => (
          <FAQItem key={i} index={i} />
        ))}
      </div>
    </div>
  );
}
