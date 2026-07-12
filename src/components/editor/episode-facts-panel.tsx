"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { useModelStore } from "@/stores/model-store";
import { Button } from "@/components/ui/button";
import { BookMarked, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

// 类别标签内联（不引 @/lib/canon/facts，避免把服务端 db 依赖带进客户端包）
const CATEGORY_ORDER = [
  "timeline",
  "character",
  "prop",
  "location",
  "faction",
  "other",
] as const;
const LABEL: Record<string, string> = {
  timeline: "时间线",
  character: "角色设定",
  prop: "关键道具",
  location: "地点",
  faction: "派系",
  other: "其他",
};

interface Fact {
  id: string;
  category: string;
  content: string;
}

/**
 * 本集提取事实展示卡（剧本页最底部，本集梗概下方）：
 * 只读展示 canon_facts 中 source_episode_id = 本集 的事实（按类别分组）。
 * 数据在剧本生成后由后台自动抽取写入；也可点"提取本集设定"手动触发/刷新。
 * 自包含拉取 GET /api/projects/[id]/canon?episodeId=xxx。
 */
export function EpisodeFactsPanel({
  projectId,
  episodeId,
}: {
  projectId: string;
  episodeId?: string | null;
}) {
  const getModelConfig = useModelStore((s) => s.getModelConfig);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const reqRef = useRef(0);
  const load = useCallback(async () => {
    if (!episodeId) return;
    const reqId = ++reqRef.current; // 竞态防护：仅最新一次请求可写入结果
    setRefreshing(true);
    try {
      const r = await apiFetch(
        `/api/projects/${projectId}/canon?episodeId=${encodeURIComponent(episodeId)}`,
      );
      const data = await r.json();
      if (reqRef.current === reqId) setFacts(data);
    } catch {
      // 被动加载失败保持空（与 ProjectMemoryEditor 一致，不打扰；主动"提取"才 toast）
    } finally {
      if (reqRef.current === reqId) {
        setLoaded(true);
        setRefreshing(false);
      }
    }
  }, [projectId, episodeId]);

  useEffect(() => {
    setLoaded(false);
    setFacts([]);
    load();
  }, [load]);

  async function extract() {
    if (!episodeId) return;
    setExtracting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_canon",
          modelConfig: getModelConfig(),
          episodeId,
        }),
      });
      const data = await res.json();
      if (typeof data.added === "number") {
        toast.success(`已提取 ${data.added} 条设定`);
        await load();
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }

  if (!episodeId) return null;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: facts.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mt-3 rounded-2xl border border-[--border-subtle] bg-white p-1.5">
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <BookMarked className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted]">
            本集提取的设定事实
          </span>
          {refreshing && (
            <Loader2 className="h-3 w-3 animate-spin text-[--text-muted]" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-1 text-[11px] text-[--text-muted] transition-colors hover:text-[--text-primary]"
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={extract}
            disabled={extracting}
          >
            {extracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            提取本集设定
          </Button>
        </div>
      </div>

      <div className="px-5 pb-3 pt-1">
        {loaded && facts.length === 0 ? (
          <p className="text-xs leading-relaxed text-[--text-muted]">
            本集尚未提取到设定事实。生成剧本后会自动提取；也可点右上角"提取本集设定"。
          </p>
        ) : (
          grouped.map((g) => (
            <div key={g.cat} className="mb-2 last:mb-0">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">
                {LABEL[g.cat] ?? g.cat}
              </div>
              <ul className="space-y-1">
                {g.items.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-start gap-2 text-sm leading-relaxed text-[--text-primary]"
                  >
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400" />
                    <span>{f.content}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
