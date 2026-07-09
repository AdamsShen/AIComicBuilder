import { getSession } from "@/lib/auth/get-session";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/pricing");
  }
  return session;
}
