import { auth } from "@/lib/auth";

/**
 * 从请求中获取已登录用户 ID。
 * 只接受 Better Auth session —— 不再回退到匿名 cookie/header。
 * 未登录返回 null，调用方应返回 401。
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user?.id) return session.user.id;
  } catch {
    // Better Auth 不可用时返回 null
  }

  return null;
}
