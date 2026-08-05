"use client";

import { useState } from "react";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { Clock } from "lucide-react";

interface GuestCtaProps {
  trialDays: number;
}

export function GuestCta({ trialDays }: GuestCtaProps) {
  const [showSignIn, setShowSignIn] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  function handleCta() {
    setIsSignUpMode(true);
    setShowSignIn(true);
  }

  function handleSignInLink(e: React.MouseEvent) {
    e.preventDefault();
    setIsSignUpMode(false);
    setShowSignIn(true);
  }

  return (
    <>
      <div className="max-w-2xl mx-auto mb-24 text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10">
            <Clock className="h-9 w-9 text-primary" />
          </div>
        </div>
        <h2 className="font-display text-2xl text-[--text-primary] mb-4">
          {trialDays} 天免费试用
        </h2>
        <p className="text-[--text-secondary] text-base mb-8 max-w-md mx-auto leading-relaxed">
          注册即享 {trialDays} 天全功能免费试用，无需绑定信用卡。试用到期后按量计费，用多少付多少。
        </p>
        <button
          onClick={handleCta}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-medium text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:bg-[#E8573A] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97]"
        >
          {trialDays} 天免费试用
        </button>
        <p className="mt-4 text-xs text-[--text-muted]">
          已有账户？<a href="#" onClick={handleSignInLink} className="text-primary hover:underline">去登录</a>
        </p>
      </div>

      <SignInDialog
        open={showSignIn}
        onOpenChange={(open) => {
          setShowSignIn(open);
          if (!open) setIsSignUpMode(false);
        }}
        initialSignUp={isSignUpMode}
      />
    </>
  );
}
