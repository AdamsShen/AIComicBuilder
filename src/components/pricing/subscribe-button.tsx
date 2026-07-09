"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

interface SubscribeButtonProps {
  priceId: string;
  interval: "month" | "year";
}

export function SubscribeButton({ priceId, interval }: SubscribeButtonProps) {
  const t = useTranslations("pricing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, interval }),
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
        className="h-10 w-full rounded-xl"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {t("pro.cta")}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
