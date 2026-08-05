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
import { User, LogOut, Wallet, Loader2, Clock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserStatus {
  trial: {
    inTrial: boolean;
    expired: boolean;
    daysLeft: number;
    endsAt: string | null;
  };
  balance: number; // 人民币分
}

export function UserMenu() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [showSignIn, setShowSignIn] = useState(false);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 拉取试用状态 + 钱包余额
  useEffect(() => {
    const userId = session?.user?.id;
    setStatus(null);
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/status");
        if (!res.ok) return;
        const data = (await res.json()) as UserStatus;
        if (!cancelled) setStatus(data);
      } catch {
        // 静默失败：拿不到状态时不显示额外信息
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // 余额转人民币元显示
  const balanceYuan = status ? (status.balance / 100).toFixed(2) : null;

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
        <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[--border-subtle] bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
          <div className="p-1.5">
            {/* 试用状态 */}
            {status?.trial && (
              <div className="px-2.5 py-2 mb-1 rounded-lg bg-[--surface]">
                {status.trial.inTrial ? (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {status.trial.daysLeft > 0
                        ? `${status.trial.daysLeft} ${t("trialDaysLeft")}`
                        : t("trialEndsToday")}
                    </span>
                  </div>
                ) : status.trial.expired ? (
                  <div className="flex items-center gap-2 text-xs text-orange-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t("trialExpired")}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* 钱包余额 */}
            {balanceYuan !== null && (
              <div className="px-2.5 py-2 mb-1 rounded-lg bg-[--surface] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[--text-secondary]">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>{t("balance")}</span>
                </div>
                <span className="text-xs font-semibold text-[--text-primary]">
                  ¥{balanceYuan}
                </span>
              </div>
            )}

            <button
              onClick={() => router.push("/wallet")}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[--text-secondary] hover:bg-[--surface] hover:text-[--text-primary] transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              {t("recharge")}
            </button>

            <div className="my-1 border-t border-[--border-subtle]" />

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
