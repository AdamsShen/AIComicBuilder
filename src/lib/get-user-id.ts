import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export async function getUserIdFromRequest(request: Request): Promise<string> {
  // 1. 尝试从 Better Auth session 获取用户 ID
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user?.id) return session.user.id;
  } catch {
    // Better Auth 不可用，回退到匿名模式
  }

  // 2. 回退到 x-user-id header（客户端 apiFetch 设置的匿名 ID）
  const headerUid = request.headers.get("x-user-id");
  if (headerUid) return headerUid;

  // 3. 回退到 ai_comic_uid cookie
  try {
    const cookieStore = await cookies();
    const cookieUid = cookieStore.get("ai_comic_uid")?.value;
    if (cookieUid) return cookieUid;
  } catch {
    // 不在支持 cookies() 的上下文中
  }

  return "";
}
