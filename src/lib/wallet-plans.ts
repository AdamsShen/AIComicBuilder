// 充值预设金额（单位：分）
export const STRIPE_TOPUP_AMOUNTS = [500, 1000, 2000, 5000, 10000]; // $5-$100
export const ALIPAY_TOPUP_AMOUNTS = [1000, 2000, 5000, 10000, 20000]; // 10-200 元

// Stripe 充值美元 → 人民币汇率（可通过 STRIPE_TO_CNY_RATE 环境变量覆盖，仅服务端）
const DEFAULT_USD_TO_CNY_RATE = 7.25;

// --- 实时汇率缓存 ---
let cachedRate: number | null = null;
let cachedAt = 0;
let pendingRatePromise: Promise<number> | null = null; // 并发去重
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

/** 从免费汇率 API 获取实时 USD→CNY 汇率（双路 fallback） */
async function fetchLiveUsdToCnyRate(): Promise<number> {
  const apis = [
    "https://api.exchangerate-api.com/v4/latest/USD",
    "https://open.er-api.com/v6/latest/USD",
  ];

  for (const url of apis) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const rate = data?.rates?.CNY as number | undefined;
      if (rate && rate > 0) return rate;
    } catch (err) {
      console.debug("[fetchLiveUsdToCnyRate]", url, "失败:", err);
    }
  }

  throw new Error("All exchange rate APIs failed");
}

/**
 * 获取当前 USD → CNY 汇率（服务端调用）
 *
 * 优先级：环境变量 STRIPE_TO_CNY_RATE → 1h 内存缓存 → 实时 API → 默认 7.25
 */
export async function getUsdToCnyRate(): Promise<number> {
  // 1. 环境变量覆盖
  const envRate = process.env.STRIPE_TO_CNY_RATE;
  if (envRate) {
    const parsed = Number(envRate);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  // 2. 内存缓存（1 小时有效）
  if (cachedRate !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  // 3. 实时 API（并发去重：复用进行中的请求）
  if (pendingRatePromise !== null) {
    try {
      return await pendingRatePromise;
    } catch {
      // 进行中的请求失败，忽略，重新发起
      pendingRatePromise = null;
    }
  }

  pendingRatePromise = fetchLiveUsdToCnyRate();
  try {
    const rate = await pendingRatePromise;
    cachedRate = rate;
    cachedAt = Date.now();
    pendingRatePromise = null;
    return rate;
  } catch {
    pendingRatePromise = null;
    // 4. 兜底：使用缓存（即使过期）或默认值
    console.warn("[getUsdToCnyRate] 实时汇率获取失败，使用回退值");
    return cachedRate ?? DEFAULT_USD_TO_CNY_RATE;
  }
}

/** 前端展示用：美元换算人民币显示（同步，仅用于预估） */
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
