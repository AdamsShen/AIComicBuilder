"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useLocale } from "next-intl";
import { ArrowLeft, Loader2, Trash2, Plus, Sparkles, BookMarked } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { isRechargeError } from "@/lib/handle-ai-error";
import { useModelStore } from "@/stores/model-store";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

const CATEGORIES = [
  { key: "timeline", label: "时间线" },
  { key: "character", label: "角色设定" },
  { key: "prop", label: "关键道具" },
  { key: "location", label: "地点" },
  { key: "faction", label: "派系" },
  { key: "other", label: "其他" },
] as const;

const CAT_LABEL: Record<string, string> = {
  timeline: "时间线",
  character: "角色",
  prop: "道具",
  location: "地点",
  faction: "派系",
  other: "其他",
};

interface Fact {
  id: string;
  category: string;
  content: string;
  sourceEpisodeId: string | null;
}

interface Episode {
  id: string;
  title: string;
  sequence: number;
}

export default function CanonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const locale = useLocale();
  const getModelConfig = useModelStore((s) => s.getModelConfig);

  const [facts, setFacts] = useState<Fact[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  // 手动新增
  const [newCat, setNewCat] = useState<string>("timeline");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  // 提取状态：{ [episodeId]: true }
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});

  // 每个分组独立筛选类别：{ [episodeId|null]: categoryKey | null }
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  // 使用字符串 key 避免 null 不可做 key 的问题
  const groupKey = (epId: string | null) => epId ?? "_manual";

  const fetchData = useCallback(async () => {
    const [factsRes, epsRes] = await Promise.all([
      apiFetch(`/api/projects/${projectId}/canon`).then((r) => r.json()),
      apiFetch(`/api/projects/${projectId}/episodes`).then((r) => r.json()),
    ]);
    setFacts(factsRes as Fact[]);
    const list: Episode[] = Array.isArray(epsRes) ? epsRes : (epsRes?.episodes ?? []);
    setEpisodes(list);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 编辑/删除 ---

  function editContent(id: string, content: string) {
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));
  }

  async function saveContent(id: string) {
    const fact = facts.find((f) => f.id === id);
    if (!fact || !fact.content.trim()) return;
    try {
      await apiFetch(`/api/projects/${projectId}/canon/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fact.content.trim() }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), isRechargeError(err) ? { action: { label: "去充值", onClick: () => { window.location.href = `/${locale}/wallet`; } }, duration: 8000 } : undefined);
      await fetchData();
    }
  }

  async function deleteFact(id: string) {
    setFacts((prev) => prev.filter((f) => f.id !== id));
    try {
      await apiFetch(`/api/projects/${projectId}/canon/${id}`, { method: "DELETE" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), isRechargeError(err) ? { action: { label: "去充值", onClick: () => { window.location.href = `/${locale}/wallet`; } }, duration: 8000 } : undefined);
      await fetchData();
    }
  }

  // --- 手动新增 ---

  async function addFact() {
    const content = newContent.trim();
    if (!content) return;
    setAdding(true);
    try {
      await apiFetch(`/api/projects/${projectId}/canon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat, content }),
      });
      setNewContent("");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), isRechargeError(err) ? { action: { label: "去充值", onClick: () => { window.location.href = `/${locale}/wallet`; } }, duration: 8000 } : undefined);
    } finally {
      setAdding(false);
    }
  }

  // --- 从某集重新提取（覆盖模式）---

  async function extractFromEpisode(episodeId: string) {
    setExtracting((prev) => ({ ...prev, [episodeId]: true }));
    try {
      const res = await apiFetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_canon",
          modelConfig: getModelConfig(),
          episodeId,
          payload: { overwrite: true },
        }),
      });
      const data = await res.json();
      if (typeof data.added === "number") {
        toast.success(`已重新提取 ${data.added} 条设定`);
        await fetchData();
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), isRechargeError(err) ? { action: { label: "去充值", onClick: () => { window.location.href = `/${locale}/wallet`; } }, duration: 8000 } : undefined);
    } finally {
      setExtracting((prev) => ({ ...prev, [episodeId]: false }));
    }
  }

  // --- 分组：按分集来源 + 无来源事实 ---

  // 构建 episodeId -> episode 映射
  const epMap = new Map(episodes.map((e) => [e.id, e]));

  // 按 sourceEpisodeId 分组
  const byEpisode = new Map<string | null, Fact[]>();
  for (const f of facts) {
    const key = f.sourceEpisodeId;
    if (!byEpisode.has(key)) byEpisode.set(key, []);
    byEpisode.get(key)!.push(f);
  }

  // 按集序排列分组
  const grouped: { episodeId: string | null; episodeLabel: string; facts: Fact[] }[] = [];
  for (const [epId, fs] of byEpisode) {
    const ep = epId ? epMap.get(epId) : null;
    const label = ep ? `第${ep.sequence}集 ${ep.title}` : "手动新增";
    grouped.push({ episodeId: epId, episodeLabel: label, facts: fs });
  }

  // 按集序排序（有来源的按 sequence，无来源的放最后）
  grouped.sort((a, b) => {
    const aEp = a.episodeId ? epMap.get(a.episodeId) : null;
    const bEp = b.episodeId ? epMap.get(b.episodeId) : null;
    const aSeq = aEp?.sequence ?? Infinity;
    const bSeq = bEp?.sequence ?? Infinity;
    return aSeq - bSeq;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[--text-muted]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-[--border-subtle] bg-white/80 backdrop-blur-xl px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/project/${projectId}/episodes`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <BookMarked className="h-3.5 w-3.5" />
            </div>
            <span className="font-display text-sm font-semibold text-[--text-primary]">
              事实管理
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-[--surface] p-4 lg:p-6 pb-24 lg:pb-6">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* 按分集分组的事实列表 */}
          {grouped.length === 0 ? (
            <div className="rounded-2xl border border-[--border-subtle] bg-white p-8 text-center">
              <BookMarked className="mx-auto h-8 w-8 text-[--text-muted] mb-3" />
              <p className="text-sm text-[--text-muted]">
                暂无已确立事实。剧本生成后会自动抽取，也可从下方各集提取。
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div
                key={group.episodeId ?? "_manual"}
                className="rounded-2xl border border-[--border-subtle] bg-white overflow-hidden"
              >
                {/* 分组标题栏 */}
                <div className="flex items-center justify-between border-b border-[--border-subtle] bg-[--surface]/50 px-5 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-[--text-primary] truncate">
                      {group.episodeLabel}
                    </span>
                    <span className="text-[11px] text-[--text-muted] shrink-0">
                      {group.facts.length} 条
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 类别筛选 */}
                    <select
                      value={filters[groupKey(group.episodeId)] ?? ""}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          [groupKey(group.episodeId)]: e.target.value || null,
                        }))
                      }
                      className="rounded-lg border border-[--border-subtle] bg-white px-2 py-1.5 text-[11px] text-[--text-secondary]"
                    >
                      <option value="">全部类别</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {group.episodeId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extractFromEpisode(group.episodeId!)}
                        disabled={extracting[group.episodeId!]}
                      >
                        {extracting[group.episodeId!] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        重新提取
                      </Button>
                    )}
                  </div>
                </div>

                {/* 该组下的事实列表（按筛选） */}
                <ul className="divide-y divide-[--border-subtle]">
                  {group.facts
                    .filter((f) => {
                      const cat = filters[groupKey(group.episodeId)];
                      return !cat || f.category === cat;
                    })
                    .map((f) => (
                    <li
                      key={f.id}
                      className="flex items-start gap-2 px-5 py-2.5"
                    >
                      {/* 类别标签 */}
                      <span className="mt-0.5 inline-flex shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {CAT_LABEL[f.category] || f.category}
                      </span>
                      {/* 内容编辑 */}
                      <input
                        value={f.content}
                        onChange={(e) => editContent(f.id, e.target.value)}
                        onBlur={() => saveContent(f.id)}
                        className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-[--text-primary] hover:border-[--border-subtle] focus:border-[--border-subtle] focus:outline-none"
                      />
                      {/* 删除 */}
                      <button
                        onClick={() => deleteFact(f.id)}
                        className="mt-0.5 shrink-0 text-[--text-muted] transition-colors hover:text-destructive"
                        aria-label="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          {/* 手动新增 */}
          <div className="rounded-2xl border border-[--border-subtle] bg-white p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted] mb-3">
              手动新增事实
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="rounded-lg border border-[--border-subtle] bg-white px-2.5 py-2 text-xs text-[--text-secondary]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addFact();
                }}
                placeholder="新增一条已确立事实…"
                className="flex-1 rounded-lg border border-[--border-subtle] bg-transparent px-3 py-2 text-sm placeholder:text-[--text-muted] focus:outline-none"
              />
              <Button
                size="sm"
                onClick={addFact}
                disabled={adding || !newContent.trim()}
              >
                {adding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                新增
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
