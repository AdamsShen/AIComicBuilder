/**
 * 分 → 支付宝要求的「元」字符串（两位小数），如 13800 → "138.00"。
 */
export function centsToYuanString(cents: number): string {
  return (cents / 100).toFixed(2);
}
