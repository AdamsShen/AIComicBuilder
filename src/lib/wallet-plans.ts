// 充值预设金额（单位：分）
export const STRIPE_TOPUP_AMOUNTS = [500, 1000, 2000, 5000, 10000]; // $5-$100
export const ALIPAY_TOPUP_AMOUNTS = [1000, 2000, 5000, 10000, 20000]; // 10-200 元

// Stripe 充值美元 → 人民币汇率（可通过 STRIPE_TO_CNY_RATE 环境变量覆盖，仅服务端）
const DEFAULT_USD_TO_CNY_RATE = 7.25;

export function getUsdToCnyRate(): number {
  const envRate = process.env.STRIPE_TO_CNY_RATE;
  if (envRate) {
    const parsed = Number(envRate);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_USD_TO_CNY_RATE;
}

/** 前端展示用：美元换算人民币显示 */
export function usdToCnyDisplay(usdCents: number): string {
  const cny = (usdCents * DEFAULT_USD_TO_CNY_RATE) / 100;
  return `¥${cny.toFixed(2)}`;
}

export function formatWalletAmount(cents: number, provider: "stripe" | "alipay"): string {
  if (provider === "alipay") {
    return `¥${(cents / 100).toFixed(2)}`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}
