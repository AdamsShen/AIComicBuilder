"use client";

import { PromptEditor } from "@/components/prompt-templates/prompt-editor";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

export default function PromptSettingsPage() {
  const t = useTranslations("promptTemplates");
  const searchParams = useSearchParams();

  const scope = (searchParams.get("scope") as "global" | "project") || "global";
  const projectId = searchParams.get("projectId") || undefined;
  const initialPromptKey = searchParams.get("prompt") || undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col animate-page-in">
      <PromptEditor
        scope={scope}
        projectId={projectId}
        initialPromptKey={initialPromptKey}
      />
    </div>
  );
}
