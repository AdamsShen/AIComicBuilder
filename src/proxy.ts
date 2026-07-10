import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// 用户标识 Cookie 名，跨请求复用
const COOKIE_NAME = "ai_comic_uid";

// 跨请求 Cookie 中间件: 确保每个请求都携带用户标识，方便服务端按 userId 查询数据
const intlMiddleware = createMiddleware(routing);

/**
 * 全局请求代理中间件
 *
 * 职责：
 * 1. 通过 next-intl 中间件处理国际化路由
 * 2. 在首次请求时生成匿名用户 ID（Cookie），服务端可在任何页面通过 userId 查询数据
 *
 * @param request - Next.js 传入的请求对象
 * @returns 经过 intl 中间件处理后的响应，必要时附带 Set-Cookie 响应头
 */
export default function proxy(request: NextRequest) {
  const response = intlMiddleware(request);

  // 确保 ai_comic_uid cookie 在页面渲染前存在
  // 如果缺失，生成随机 UUID 作为匿名标识，后续客户端 FingerprintProvider 会用真实指纹覆盖
  if (!request.cookies.get(COOKIE_NAME)) {
    const uid = crypto.randomUUID().replace(/-/g, "");
    response.cookies.set(COOKIE_NAME, uid, {
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

/**
 * Next.js 中间件路由匹配配置
 *
 * matcher 使用正则排除以下路径（不触发中间件）：
 * - /api/*          后端 API 路由
 * - /_next/*        Next.js 内部资源
 * - /_vercel/*      Vercel 平台内部
 * - 静态文件（含 . 扩展名的路径）
 */
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
