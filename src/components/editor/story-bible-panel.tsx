"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { useModelStore } from "@/stores/model-store";
import { Button } from "@/components/ui/button";
import { BookMarked, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

// 类别常量内联在此（不从 @/lib/canon/facts 引入，避免把服务端 db 依赖带进客户端包）
const CATEGORIES = [
  { key: "timeline", label: "时间线" },
  { key: "character", label: "角色设定" },
  { key: "prop", label: "关键道具" },
  { key: "location", label: "地点" },
  { key: "faction", label: "派系" },
  { key: "other", label: "其他" },
] as const;

interface Fact {
  id: string;
  category: string;
  content: string;
  sourceEpisodeId: string | null;
}
interface EpisodeLite {
  id: string;
  title: string;
  sequence: number;
}

/**
 * 设定集（Story Bible / Canon）项目级面板：
 * - 列出已确立事实（按类别分组），支持行内编辑、删除、手动新增。
 * - "从某集提取设定"：对存量分集补种 canon（新集生成时会自动抽取）。
 * 自包含读写（GET/POST/PATCH/DELETE /api/projects/[id]/canon），不经 project-store。
 */
export function StoryBiblePanel({ projectId }: { projectId: string }) {
  const getModelConfig = useModelStore((s) => s.getModelConfig);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractEp, setExtractEp] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [newCat, setNewCat] = useState<string>("timeline");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/projects/${projectId}/canon`);
      setFacts(await r.json());
    } catch {
      // 忽略：加载失败保持空列表
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch(`/api/projects/${projectId}/episodes`)
      .then((r) => r.json())
      .then((d) => {
        const list: EpisodeLite[] = Array.isArray(d) ? d : (d?.episodes ?? []);
        setEpisodes(list);
        if (list[0]) setExtractEp(list[0].id);
      })
      .catch(() => {});
  }, [projectId]);

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
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

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
      toast.error(err instanceof Error ? err.message : String(err));
      await load();
    }
  }

  async function deleteFact(id: string) {
    setFacts((prev) => prev.filter((f) => f.id !== id)); // 乐观删除
    try {
      await apiFetch(`/api/projects/${projectId}/canon/${id}`, {
        method: "DELETE",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      await load();
    }
  }

  async function extractFromEpisode() {
    if (!extractEp) return;
    setExtracting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_canon",
          modelConfig: getModelConfig(),
          episodeId: extractEp,
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

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: facts.filter((f) => f.category === c.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rounded-2xl border border-[--border-subtle] bg-white p-1.5">
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <BookMarked className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[--text-muted]">
            设定集 · 已确立事实
          </span>
          {loading && (
            <Loader2 className="h-3 w-3 animate-spin text-[--text-muted]" />
          )}
        </div>
        {episodes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select
              value={extractEp}
              onChange={(e) => setExtractEp(e.target.value)}
              className="rounded-md border border-[--border-subtle] bg-white px-2 py-1 text-xs text-[--text-secondary]"
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  第{ep.sequence}集 {ep.title}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={extractFromEpisode}
              disabled={extracting}
            >
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              从该集提取
            </Button>
          </div>
        )}
      </div>

      {/* 事实列表（按类别分组） */}
      <div className="px-5 pb-2">
        {!loading && facts.length === 0 && (
          <p className="py-2 text-xs text-[--text-muted]">
            暂无已确立事实。新集生成剧本时会自动抽取；也可点上方"从该集提取"补种存量分集，或在下方手动新增。
          </p>
        )}
        {grouped.map((g) => (
          <div key={g.key} className="mb-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">
              {g.label}
            </div>
            <ul className="space-y-1">
              {g.items.map((f) => (
                <li key={f.id} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400" />
                  <input
                    value={f.content}
                    onChange={(e) => editContent(f.id, e.target.value)}
                    onBlur={() => saveContent(f.id)}
                    className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-[--text-primary] hover:border-[--border-subtle] focus:border-[--border-subtle] focus:outline-none"
                  />
                  <button
                    onClick={() => deleteFact(f.id)}
                    className="mt-1 text-[--text-muted] transition-colors hover:text-destructive"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 手动新增一条 */}
      <div className="flex items-center gap-1.5 border-t border-[--border-subtle] px-5 py-2">
        <select
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          className="rounded-md border border-[--border-subtle] bg-white px-2 py-1.5 text-xs text-[--text-secondary]"
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
          placeholder="新增一条已确立事实，如：屠村时阿离10岁"
          className="flex-1 rounded-md border border-[--border-subtle] bg-transparent px-2 py-1.5 text-sm placeholder:text-[--text-muted] focus:outline-none"
        />
        <Button size="sm" onClick={addFact} disabled={adding || !newContent.trim()}>
          {adding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          新增
        </Button>
      </div>
    </div>
  );
}
