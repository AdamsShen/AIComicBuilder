import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { projects, promptTemplates, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 将匿名用户（通过 ai_comic_uid cookie 标识）的项目迁移到已认证用户。
 * 在 Dashboard 页面首次加载时调用，确保注册/登录后不丢失之前的数据。
 */
export async function migrateAnonymousProjects(userId: string) {
  const cookieStore = await cookies();
  const anonUid = cookieStore.get("ai_comic_uid")?.value;
  if (!anonUid || anonUid === userId) return;

  // 更新 projects 表
  const projResult = await db
    .update(projects)
    .set({ userId })
    .where(eq(projects.userId, anonUid));

  // 更新 promptTemplates 中 project 级别的
  await db
    .update(promptTemplates)
    .set({ userId })
    .where(eq(promptTemplates.userId, anonUid));

  // 更新 agents
  await db
    .update(agents)
    .set({ userId })
    .where(eq(agents.userId, anonUid));

  if (projResult.changes > 0) {
    console.log(
      `[Migration] Moved ${projResult.changes} projects from anonymous (${anonUid}) to user ${userId}`
    );
  }
}
