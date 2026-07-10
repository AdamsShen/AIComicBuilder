"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * 处理结账回跳（Stripe 与支付宝共用）。
 * 命中 ?checkout=success 时弹成功提示；若是支付宝回跳（带 order），
 * 先主动查单确认落库，再清理 URL query 避免刷新重复提示。
 */
export function CheckoutSuccessToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("pricing");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (params.get("checkout") !== "success") return;
    handled.current = true;

    const provider = params.get("provider");
    const order = params.get("order");

    async function confirm() {
      // 支付宝：本地无公网 notify 时，靠主动查单兜底落库
      if (provider === "alipay" && order) {
        try {
          await fetch("/api/alipay/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outTradeNo: order }),
          });
        } catch {
          // 查单失败不阻塞提示；notify 仍会异步补齐
        }
      }
      toast.success(t("checkoutSuccess"));
      router.replace(pathname);
    }

    confirm();
  }, [params, pathname, router, t]);

  return null;
}
