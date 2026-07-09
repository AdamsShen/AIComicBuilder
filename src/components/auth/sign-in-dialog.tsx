"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { signIn, signUp } from "@/lib/auth/client";
import { useTranslations } from "next-intl";
import { Mail, Loader2, ArrowRight, CheckCircle } from "lucide-react";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const signUpResult = await signUp.email({
          email,
          password,
          name: email.split("@")[0],
        });
        // 注册失败时直接显示错误
        if (signUpResult.error) {
          throw new Error(signUpResult.error.message || "Registration failed");
        }
        // 注册成功，Better Auth 自动创建 session，跳转项目列表
        handleClose(false);
        window.location.href = "/";
        return;
      }

      const signInResult = await signIn.email({
        email,
        password,
      });
      if (signInResult.error) {
        throw new Error(signInResult.error.message || "Login failed");
      }
      // 登录成功，跳转到项目列表
      handleClose(false);
      window.location.href = "/";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setSent(false);
      setError(null);
      setEmail("");
      setPassword("");
      setIsSignUp(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle>{t("checkEmail")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("checkEmailDesc")}
            </DialogDescription>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                setSent(false);
                handleClose(false);
              }}
            >
              {t("done")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {isSignUp ? t("createAccount") : t("signIn")}
              </DialogTitle>
              <DialogDescription>
                {isSignUp ? t("createAccountDesc") : t("signInDesc")}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t("password")}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isSignUp ? t("createAccount") : t("signIn")}
              </Button>

              <p className="text-center text-xs text-[--text-muted]">
                {isSignUp ? t("haveAccount") : t("noAccount")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-[--primary] hover:underline font-medium"
                >
                  {isSignUp ? t("signIn") : t("createAccount")}
                </button>
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
