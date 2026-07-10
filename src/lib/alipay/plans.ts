import type { BillingInterval } from "@/components/pricing/pricing-header";

/**
 * 支付宝一次性购买会员的价格与商品信息。
 *
 * 价格来自环境变量（人民币「元」）：ALIPAY_PRICE_MONTHLY / ALIPAY_PRICE_YEARLY。
 * 内部统一以「分」为单位存储与比对，避免浮点误差。
 */

const DEFAULT_MONTHLY_YUAN = 138;
const DEFAULT_YEARLY_YUAN = 1380;

function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 读取某周期的金额（单位：分）。 */
export function getAlipayAmountCents(interval: BillingInterval): number {
  const raw =
    interval === "year"
      ? process.env.ALIPAY_PRICE_YEARLY
      : process.env.ALIPAY_PRICE_MONTHLY;
  const yuan = raw ? Number(raw) : NaN;
  if (Number.isFinite(yuan) && yuan > 0) return yuanToCents(yuan);
  return yuanToCents(
    interval === "year" ? DEFAULT_YEARLY_YUAN : DEFAULT_MONTHLY_YUAN,
  );
}

/** 分 → 支付宝要求的「元」字符串（两位小数），如 13800 → "138.00"。 */
export function centsToYuanString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 传给支付宝的商品标题。 */
export function getAlipaySubject(interval: BillingInterval): string {
  return interval === "year" ? "Pro 会员（年）" : "Pro 会员（月）";
}
