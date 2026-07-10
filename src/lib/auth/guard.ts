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
 * 进入项目页（dashboard）的门槛：已登录且已拥有套餐（免费或 Pro）。
 * 未登录 → 由 requireAuth 跳定价页；已登录但未选套餐 → 跳定价页停留选择。
 */
export async function requirePlan() {
  const session = await requireAuth();
  const ok = await hasActivePlan(session.user.id);
  if (!ok) {
    redirect("/pricing");
  }
  return session;
}
