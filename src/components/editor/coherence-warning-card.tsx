"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";

interface Contradiction {
  severity?: string;
  fact?: string;
  conflict?: string;
  evidence?: string;
}
interface Report {
  contradictions?: Contradiction[];
  titleAlignment?: { aligned?: boolean; note?: string };
}

/**
 * 连贯性校验（D）建议式提示卡：读取本集 coherenceReport（剧本生成后后台写入），
 * 展示与已确立事实/前情的矛盾，以及标题/主题是否对齐。仅提示，不自动改写。
 * 自包含拉取 GET /api/projects/[id]/episodes/[episodeId]，与生成解耦。
 */
export function CoherenceWarningCard({
  projectId,
  episodeId,
}: {
  projectId: string;
  episodeId?: string | null;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const reqRef = useRef(0);
  const load = useCallback(async () => {
    if (!episodeId) return;
    const reqId = ++reqRef.current; // 竞态防护：仅最新一次请求可写入结果
    setRefreshing(true);
    try {
      const r = await apiFetch(
        `/api/projects/${projectId}/episodes/${encodeURIComponent(episodeId)}`,
      );
      const d = await r.json();
      if (reqRef.current !== reqId) return;
      const raw = d?.coherenceReport;
      setReport(raw ? (JSON.parse(raw) as Report) : null);
    } catch {
      if (reqRef.current === reqId) setReport(null);
    } finally {
      if (reqRef.current === reqId) {
        setLoaded(true);
        setRefreshing(false);
      }
    }
  }, [projectId, episodeId]);

  useEffect(() => {
    setLoaded(false);
    setReport(null);
    load();
  }, [load]);

  // 尚无报告（未生成过 / 生成中）或未选分集：不渲染
  if (!episodeId || !loaded || !report) return null;

  const contradictions = report.contradictions ?? [];
  const titleMisaligned = report.titleAlignment?.aligned === false;
  const hasIssues = contradictions.length > 0 || titleMisaligned;

  return (
    <div
      className={`mb-3 rounded-2xl border p-4 ${
        hasIssues
          ? "border-amber-300 bg-amber-50/60"
          : "border-emerald-200 bg-emerald-50/50"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          <span className="text-xs font-semibold text-[--text-primary]">
            {hasIssues ? "连贯性提示" : "未发现连贯性问题"}
          </span>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-1 text-[11px] text-[--text-muted] transition-colors hover:text-[--text-primary]"
        >
          {refreshing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          刷新
        </button>
      </div>

      {contradictions.length > 0 && (
        <ul className="space-y-2">
          {contradictions.map((c, i) => (
            <li key={i} className="text-xs leading-relaxed text-[--text-secondary]">
              <span
                className={`mr-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-medium ${
                  c.severity === "high"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {c.severity === "high" ? "冲突" : "存疑"}
              </span>
              {c.fact && (
                <span className="text-[--text-primary]">已定：{c.fact}</span>
              )}
              {c.conflict && <span> ／ 本集：{c.conflict}</span>}
              {c.evidence && (
                <span className="text-[--text-muted]">（「{c.evidence}」）</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {titleMisaligned && (
        <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">
          <span className="mr-1.5 inline-block rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium text-sky-700">
            标题
          </span>
          {report.titleAlignment?.note || "本集内容与标题/主题不太贴合。"}
        </p>
      )}
    </div>
  );
}
