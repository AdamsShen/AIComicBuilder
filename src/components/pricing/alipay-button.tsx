"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

interface AlipayButtonProps {
  interval: "month" | "year";
}

/**
 * 支付宝支付按钮：调用 /api/alipay/create 创建订单，成功后跳转支付宝收银台。
 * 与 Stripe 的 SubscribeButton 并列（一次性购买会员时长）。
 */
export function AlipayButton({ interval }: AlipayButtonProps) {
  const t = useTranslations("pricing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alipay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="outline"
        className="h-10 w-full rounded-xl border-[#1677ff]/40 text-[#1677ff] hover:bg-[#1677ff]/5 hover:text-[#1677ff]"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {t("alipayCta")}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
