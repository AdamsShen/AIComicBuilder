"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInDialog } from "./sign-in-dialog";
import { useTranslations } from "next-intl";
import { User, LogOut, CreditCard, RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PlanState {
  plan: "free" | "pro" | null;
  isPro: boolean;
  source: "stripe" | "alipay" | null;
}

export function UserMenu() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [showSignIn, setShowSignIn] = useState(false);
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  // 挂载门控：SSR 与首帧客户端渲染保持一致（都显示加载态），
  // 挂载后再切换到 useSession 的真实状态，避免 hydration 不匹配。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 拉取套餐状态，决定显示"账单管理"(Pro) 还是"取消订阅"(免费)
  useEffect(() => {
    const userId = session?.user?.id;
    // 用户变化时先清空，避免切换账号/刷新时残留上一用户的状态
    setPlanState(null);
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plan");
        if (!res.ok) return;
        const data = (await res.json()) as PlanState;
        if (!cancelled) setPlanState(data);
      } catch {
        // 忽略：拿不到状态时不显示套餐相关按钮
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // 免费用户取消订阅：清空套餐 → 回定价页重新选择/购买 Pro
  async function handleCancelPlan() {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/plan/cancel", { method: "POST" });
      if (res.ok) {
        window.location.href = "/pricing";
      } else {
        setCancelLoading(false);
      }
    } catch (err) {
      console.error("Cancel plan error:", err);
      setCancelLoading(false);
    }
  }

  if (!mounted || isPending) {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[--text-muted]" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowSignIn(true)}
          className="gap-1.5"
        >
          <User className="h-3.5 w-3.5" />
          <span className="text-xs">{t("signIn")}</span>
        </Button>
        <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
      </>
    );
  }

  return (
    <>
      <div className="relative group">
        <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[--text-secondary] hover:bg-[--surface] hover:text-[--text-primary] transition-colors">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[--primary]/10 text-[--primary] text-[10px] font-semibold">
            {session.user.email?.charAt(0).toUpperCase()}
          </div>
          <span className="max-w-[100px] truncate hidden sm:inline">
            {session.user.email}
          </span>
        </button>

        {/* Dropdown */}
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-[--border-subtle] bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
          <div className="p-1.5">
            {planState?.isPro ? (
              <button
                onClick={() => router.push("/billing")}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[--text-secondary] hover:bg-[--surface] hover:text-[--text-primary] transition-colors"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {t("billing")}
              </button>
            ) : planState?.plan === "free" ? (
              <button
                onClick={handleCancelPlan}
                disabled={cancelLoading}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[--text-secondary] hover:bg-[--surface] hover:text-[--text-primary] transition-colors"
              >
                {cancelLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t("cancelPlan")}
              </button>
            ) : null}
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/pricing";
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("signOut")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
