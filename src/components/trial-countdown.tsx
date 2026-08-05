"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface TrialStatus {
  inTrial: boolean;
  expired: boolean;
  daysLeft: number;
  endsAt: string | null;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
}

function calcRemaining(endsAt: string): TimeRemaining {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const totalMinutes = Math.floor(diff / 60000);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

/** 紧凑摘要：按钮上显示的短文本 */
function compactLabel(r: TimeRemaining): string {
  if (r.days > 0) return `${r.days}天${r.hours}时`;
  if (r.hours > 0) return `${r.hours}时${r.minutes}分`;
  if (r.minutes > 0) return `${r.minutes}分钟`;
  return "不到1分钟";
}

/** 详细标签：弹层中的完整倒计时 */
function detailLabel(r: TimeRemaining): string {
  const parts: string[] = [];
  if (r.days > 0) parts.push(`${r.days} 天`);
  if (r.hours > 0) parts.push(`${r.hours} 小时`);
  parts.push(`${r.minutes} 分钟`);
  return parts.join(" ");
}

export function TrialCountdown() {
  const t = useTranslations("auth");
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateRemaining = useCallback((endsAt: string) => {
    const r = calcRemaining(endsAt);
    setRemaining(r);
    if (r.days === 0 && r.hours === 0 && r.minutes === 0) {
      setStatus((prev) =>
        prev ? { ...prev, inTrial: false, expired: true } : null,
      );
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, []);

  // 首次加载 + 每分钟刷新
  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/user/status");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        const trial: TrialStatus = data.trial;
        setStatus(trial);

        if (trial.inTrial && trial.endsAt) {
          updateRemaining(trial.endsAt);
          if (!intervalRef.current) {
            intervalRef.current = setInterval(() => {
              if (trial.endsAt) updateRemaining(trial.endsAt);
            }, 60_000);
          }
        }
      } catch {
        // 静默
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [updateRemaining]);

  // 点击外部关闭弹层
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // 不显示条件：无试用信息 / 已到期 / 剩余 0
  if (!status?.inTrial || !status.endsAt || !remaining) return null;
  if (remaining.days === 0 && remaining.hours === 0 && remaining.minutes === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
      >
        <Clock className="h-3.5 w-3.5" />
        <span className="tabular-nums">{compactLabel(remaining)}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-[--border-subtle] bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-[--text-muted]">
              {t("trialDaysLeft")}
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold text-amber-600 tabular-nums">
              {detailLabel(remaining)}
            </p>
            <div className="mt-3 pt-3 border-t border-[--border-subtle]">
              <p className="text-[11px] text-[--text-muted] leading-relaxed">
                试用期内所有 AI 功能免费使用，到期后按量计费。
              </p>
              <p className="mt-1 text-[11px] text-[--text-muted]">
                到期时间：{new Date(status.endsAt).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
