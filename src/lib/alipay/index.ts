import { AlipaySdk } from "alipay-sdk";

let cached: AlipaySdk | null = null;

/**
 * 惰性构造支付宝开放平台 SDK 单例（电脑网站支付）。
 *
 * 放在函数内构造、而非模块顶层：未配置 ALIPAY_* 时不会在 import 阶段抛错，
 * 而是在真正调用支付接口时抛出可被路由 try/catch 捕获的清晰错误。
 *
 * 环境变量：
 * - ALIPAY_APP_ID        开放平台应用 appId
 * - ALIPAY_PRIVATE_KEY   应用私钥（PKCS1，去掉 PEM 头尾的纯 base64 亦可）
 * - ALIPAY_PUBLIC_KEY    支付宝公钥（用于验签回调）
 * - ALIPAY_GATEWAY       网关地址（生产/沙箱）
 */
export function getAlipaySdk(): AlipaySdk {
  if (cached) return cached;

  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!appId || !privateKey || !alipayPublicKey) {
    throw new Error(
      "支付宝未配置：请设置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY",
    );
  }

  cached = new AlipaySdk({
    appId,
    privateKey,
    alipayPublicKey,
    gateway:
      process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
    signType: "RSA2",
  });
  return cached;
}
