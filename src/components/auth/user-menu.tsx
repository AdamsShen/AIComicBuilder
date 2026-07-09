"use client";

import { useState } from "react";
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
import { User, LogOut, CreditCard, Loader2 } from "lucide-react";

export function UserMenu() {
  const t = useTranslations("auth");
  const { data: session, isPending } = useSession();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch (err) {
      console.error("Portal error:", err);
    } finally {
      setPortalLoading(false);
    }
  }

  if (isPending) {
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
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[--text-secondary] hover:bg-[--surface] hover:text-[--text-primary] transition-colors"
            >
              {portalLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="h-3.5 w-3.5" />
              )}
              {t("billing")}
            </button>
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
