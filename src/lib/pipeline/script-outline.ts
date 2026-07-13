import { db } from "@/lib/db";
import { projects, episodes } from "@/lib/db/schema";
import { resolveAIProvider } from "@/lib/ai/provider-factory";
import type { ModelConfigPayload } from "@/lib/ai/provider-factory";
import { resolvePrompt } from "@/lib/ai/prompts/resolver";
import { buildEpisodeMemoryContext } from "@/lib/ai/memory-context";
import { eq } from "drizzle-orm";
import type { Task } from "@/lib/task-queue";

export async function handleScriptOutline(task: Task) {
  const payload = task.payload as {
    projectId: string;
    episodeId?: string;
    idea: string;
    modelConfig?: ModelConfigPayload;
    userId?: string;
    locale?: string;
  };

  const { projectId, episodeId, idea } = payload;

  const systemPrompt = await resolvePrompt("script_outline", {
    userId: payload.userId ?? "",
    projectId,
    locale: payload.locale,
  });

  const ai = resolveAIProvider(payload.modelConfig);
  // 跨分集记忆前缀（世界观 + 角色名册 + 前情提要）
  const memoryContext = await buildEpisodeMemoryContext(projectId, episodeId);
  const result = await ai.generateText(memoryContext + `创意构想：${idea}`, {
    systemPrompt,
    temperature: 0.7,
  });

  const outline = result.trim();

  // Save outline
  if (episodeId) {
    await db
      .update(episodes)
      .set({ outline, updatedAt: new Date() })
      .where(eq(episodes.id, episodeId));
  } else {
    await db
      .update(projects)
      .set({ outline, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  return { outline };
}
