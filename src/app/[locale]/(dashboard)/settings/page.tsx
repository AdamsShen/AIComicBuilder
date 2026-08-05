"use client";

import { DefaultModelPicker } from "@/components/settings/default-model-picker";
import { ProviderSection } from "@/components/settings/provider-section";
import { AgentSection } from "@/components/settings/agent-section";
import { useTranslations, useLocale } from "next-intl";
import { Zap, Type, ImageIcon, VideoIcon, Wand2 } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-4xl animate-page-in space-y-5">
      {/* Default model selection */}
      <div className="rounded-2xl border border-[--border-subtle] bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted]">
          <Zap className="h-3.5 w-3.5" />
          {t("defaultModels")}
        </h3>
        <DefaultModelPicker />
      </div>

      {/* Prompt Templates link */}
      <Link
        href={`/${locale}/settings/prompts`}
        className="flex items-center gap-3 rounded-2xl border border-[--border-subtle] bg-white p-5 transition-all duration-200 hover:border-[--border-hover] hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wand2 className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold">{t("promptTemplates")}</div>
          <div className="text-xs text-[--text-muted]">{t("promptTemplatesDesc")}</div>
        </div>
      </Link>

      {/* Agent Management */}
      <AgentSection />

      {/* Language Models section */}
      <ProviderSection
        capability="text"
        label={t("languageModels")}
        icon={<Type className="h-3.5 w-3.5" />}
        defaultProtocol="openai"
        defaultBaseUrl="https://api.openai.com"
      />

      {/* Image Models section */}
      <ProviderSection
        capability="image"
        label={t("imageModels")}
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        defaultProtocol="kling"
        defaultBaseUrl="https://api.klingai.com"
      />

      {/* Video Models section */}
      <ProviderSection
        capability="video"
        label={t("videoModels")}
        icon={<VideoIcon className="h-3.5 w-3.5" />}
        defaultProtocol="kling"
        defaultBaseUrl="https://api.klingai.com"
      />
    </div>
  );
}
