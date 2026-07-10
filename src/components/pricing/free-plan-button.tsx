"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/**
 * 免费套餐选择按钮（已登录时显示）：
 * 标记用户为免费套餐，成功后跳转项目页。
 */
export function FreePlanButton() {
  const t = useTranslations("pricing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/free", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[--border-subtle] bg-white text-sm font-medium text-[--text-primary] transition-colors hover:bg-[--surface] disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("free.cta")}
      </button>
      {error && (
        <p className="text-xs text-destructive mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
