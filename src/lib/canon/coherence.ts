import { db } from "@/lib/db";
import { episodes } from "@/lib/db/schema";
import { eq, and, lt, asc } from "drizzle-orm";
import { generateText } from "ai";
import {
  createLanguageModel,
  extractJSON,
  type ProviderConfig,
} from "@/lib/ai/ai-sdk";
import {
  COHERENCE_CHECK_SYSTEM,
  buildCoherenceCheckPrompt,
} from "@/lib/ai/prompts/coherence-check";
import { getCanonFacts, formatCanonFacts } from "./facts";

/**
 * 连贯性 + 标题对齐校验（D）：把一集新剧本与"已确立事实 + 前情 + 本集标题"逐条比对，
 * 结果（JSON 字符串）写回 episodes.coherenceReport，供前端建议式提示。
 *
 * - best-effort：无剧本/AI 返回非法 JSON/异常，均仅日志、不写坏数据、不抛。
 * - 顺序约束：必须在"抽取本集新事实之前"调用，才能对比前序集确立的 canon
 *   （否则本集事实先入库，等于自己和自己比，永远不矛盾）。
 */
export async function checkEpisodeCoherence(
  projectId: string,
  episodeId: string,
  script: string,
  textModel: ProviderConfig,
): Promise<void> {
  if (!script.trim()) return;
  try {
    const [ep] = await db
      .select({
        sequence: episodes.sequence,
        title: episodes.title,
        description: episodes.description,
        keywords: episodes.keywords,
      })
      .from(episodes)
      .where(and(eq(episodes.id, episodeId), eq(episodes.projectId, projectId)));
    if (!ep) return;

    const canonText = formatCanonFacts(await getCanonFacts(projectId));

    // 前序各集梗概（sequence < 本集）
    const prior = await db
      .select({
        sequence: episodes.sequence,
        title: episodes.title,
        summary: episodes.summary,
      })
      .from(episodes)
      .where(
        and(eq(episodes.projectId, projectId), lt(episodes.sequence, ep.sequence)),
      )
      .orderBy(asc(episodes.sequence));
    const priorSummaries = prior
      .filter((e) => e.summary && e.summary.trim())
      .map((e) => `第${e.sequence}集《${e.title}》：${e.summary!.trim()}`)
      .join("\n");

    const model = createLanguageModel(textModel);
    const { text } = await generateText({
      model,
      system: COHERENCE_CHECK_SYSTEM,
      prompt: buildCoherenceCheckPrompt({
        script,
        canonFacts: canonText,
        priorSummaries,
        title: ep.title ?? "",
        description: ep.description ?? "",
        keywords: ep.keywords ?? "",
      }),
      temperature: 0.1,
    });

    // 存前先 parse 一遍，非法 JSON 直接落到 catch，绝不写坏数据
    const report = extractJSON(text);
    JSON.parse(report);
    await db
      .update(episodes)
      .set({ coherenceReport: report })
      .where(and(eq(episodes.id, episodeId), eq(episodes.projectId, projectId)));
    console.log(`[Canon] 连贯性报告已保存（episode=${episodeId}）`);
  } catch (err) {
    console.error("[Canon] 连贯性校验失败:", err);
  }
}
