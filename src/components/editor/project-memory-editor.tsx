"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { useModelStore } from "@/stores/model-store";
import { Globe, ScrollText, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  /** 当前分集 id；给定时显示"本集梗概/前情"编辑；否则只显示世界观 */
  episodeId?: string | null;
}

/**
 * 跨分集记忆的编辑入口：
 * - 世界观设定（项目级，PATCH /api/projects/[id]）
 * - 本集梗概/前情（分集级，PATCH episode.summary；可点"生成梗概"用 AI 重生成）
 * 均为自包含读写，不经过 project-store。
 */
export function ProjectMemoryEditor({ projectId, episodeId }: Props) {
  const t = useTranslations("project");
  const getModelConfig = useModelStore((s) => s.getModelConfig);
  const [worldSetting, setWorldSetting] = useState("");
  const [summary, setSummary] = useState("");
  const [savingWS, setSavingWS] = useState(false);
  const [savingSum, setSavingSum] = useState(false);
  const [genSum, setGenSum] = useState(false);
  // 初始加载成功前禁止保存，避免把空值 PATCH 覆盖掉已存内容
  const wsLoaded = useRef(false);
  const sumLoaded = useRef(false);

  useEffect(() => {
    if (episodeId) return; // 世界观是项目级全局设定，仅在项目层加载/编辑
    let cancelled = false;
    wsLoaded.current = false;
    apiFetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setWorldSetting(d?.worldSetting ?? "");
        wsLoaded.current = true;
      })
      .catch(() => {
        // 加载失败：保持 wsLoaded=false，保存被禁用，避免覆盖已有世界观
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, episodeId]);

  useEffect(() => {
    sumLoaded.current = false;
    if (!episodeId) {
      setSummary("");
      return;
    }
    let cancelled = false;
    apiFetch(`/api/projects/${projectId}/episodes/${episodeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSummary(d?.summary ?? "");
        sumLoaded.current = true;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, episodeId]);

  const saveWorldSetting = useCallback(async () => {
    if (!wsLoaded.current) return; // 未成功加载前不保存，防止覆盖
    setSavingWS(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldSetting }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingWS(false);
    }
  }, [projectId, worldSetting]);

  const saveSummary = useCallback(async () => {
    if (!episodeId || !sumLoaded.current) return;
    setSavingSum(true);
    try {
      await apiFetch(`/api/projects/${projectId}/episodes/${episodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSum(false);
    }
  }, [projectId, episodeId, summary]);

  async function handleGenSummary() {
    if (!episodeId) return;
    setGenSum(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "episode_summary",
          modelConfig: getModelConfig(),
          episodeId,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        toast.success(t("summaryGenerated"));
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGenSum(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[--border-subtle] bg-white p-1.5">
      {/* 世界观设定：仅项目级显示（不在分集内编辑） */}
      {!episodeId && (
        <>
          <div className="flex items-center gap-2 px-5 pt-3 pb-1">
            <Globe className="h-3.5 w-3.5 text-sky-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted]">
              {t("worldSetting")}
            </span>
            {savingWS && (
              <Loader2 className="h-3 w-3 animate-spin text-[--text-muted]" />
            )}
          </div>
          <Textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            onBlur={saveWorldSetting}
            placeholder={t("worldSettingPlaceholder")}
            rows={3}
            className="resize-none rounded-xl border-0 bg-transparent px-5 pb-3 font-mono text-sm leading-relaxed placeholder:text-[--text-muted] focus-visible:ring-0"
          />
        </>
      )}

      {/* 本集梗概/前情（仅分集模式） */}
      {episodeId && (
        <>
          <div className="flex items-center justify-between px-5 pt-2 pb-1">
            <div className="flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted]">
                {t("episodeSummary")}
              </span>
              {savingSum && (
                <Loader2 className="h-3 w-3 animate-spin text-[--text-muted]" />
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenSummary}
              disabled={genSum}
            >
              {genSum ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {t("generateSummary")}
            </Button>
          </div>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={saveSummary}
            placeholder={t("episodeSummaryPlaceholder")}
            rows={3}
            className="resize-none rounded-xl border-0 bg-transparent px-5 pb-3 font-mono text-sm leading-relaxed placeholder:text-[--text-muted] focus-visible:ring-0"
          />
        </>
      )}
    </div>
  );
}
