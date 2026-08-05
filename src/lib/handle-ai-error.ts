import { ApiError } from "@/lib/api-fetch";
import { toast } from "sonner";

/** 检查错误是否为充值引导错误（402 Payment Required） */
export function isRechargeError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}

/**
 * 统一的 AI 调用错误处理。
 * - 402 (余额不足) → 显示带"去充值"按钮的 toast，返回消息
 * - 其他错误 → 仅返回消息，由调用方自行展示
 */
export function handleAIError(
  err: unknown,
  rechargeUrl: string,
): string {
  if (isRechargeError(err)) {
    const msg = (err as ApiError).message;
    toast.error(msg, {
      action: {
        label: "去充值",
        onClick: () => {
          window.location.href = rechargeUrl;
        },
      },
      duration: 10000,
    });
    return msg;
  }
  return err instanceof Error ? err.message : String(err);
}
