import { getSession } from "@/lib/auth/get-session";
import { hasActivePlan } from "@/lib/entitlement";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/pricing");
  }
  return session;
}

/**
 * 进入项目页（dashboard）的门槛：已登录即可。
 * 注册用户自动进入试用期，无需再选择免费/Pro 套餐。
 */
export async function requirePlan() {
  const session = await requireAuth();
  const ok = await hasActivePlan(session.user.id);
  if (!ok) {
    redirect("/pricing");
  }
  return session;
}
