import { db } from "@/lib/db";
import { canonFacts } from "@/lib/db/schema";
import { generateText } from "ai";
import {
  createLanguageModel,
  extractJSON,
  type ProviderConfig,
} from "@/lib/ai/ai-sdk";
import { id as genId } from "@/lib/id";
import {
  CANON_EXTRACT_SYSTEM,
  buildCanonExtractPrompt,
} from "@/lib/ai/prompts/canon-extract";
import {
  getCanonFacts,
  formatCanonFacts,
  CANON_CATEGORIES,
  type CanonCategory,
} from "./facts";

interface ExtractedFact {
  category?: string;
  content?: string;
}

/**
 * 从一集剧本抽取"跨集恒定的新事实"，去重后追加进 canon_facts。
 * - 去重：把已有 canon 清单喂给 AI，只要求返回新增项（照搬角色抽取的去重范式）。
 * - best-effort：无剧本/解析失败仅日志，不抛。
 *
 * @param episodeId 事实来源分集；手动/无来源传 null（sourceEpisodeId 置空）
 * @param textModel 文本模型 Provider 配置（modelConfig.text）
 * @returns 实际新增入库的事实条数
 *
 * 输入输出示例：
 *   输入 script="…屠村那年阿离十岁…" existing=[]
 *   AI 返回 [{ "category":"timeline", "content":"屠村时阿离10岁" }]
 *   → 入库 1 条，返回 1
 */
export async function extractCanonFacts(
  projectId: string,
  episodeId: string | null,
  script: string,
  textModel: ProviderConfig,
): Promise<number> {
  if (!script.trim()) return 0;
  try {
    const existing = await getCanonFacts(projectId);
    const existingText = formatCanonFacts(existing);

    const model = createLanguageModel(textModel);
    const { text } = await generateText({
      model,
      system: CANON_EXTRACT_SYSTEM,
      prompt: buildCanonExtractPrompt(script, existingText),
      temperature: 0.2,
    });

    const parsed = JSON.parse(extractJSON(text)) as ExtractedFact[];
    if (!Array.isArray(parsed)) return 0;

    const rows = parsed
      .filter((f) => f?.content && f.content.trim())
      .map((f) => ({
        id: genId(),
        projectId,
        // 非法类别兜底到 other，避免枚举约束失败
        category: (CANON_CATEGORIES.includes(f.category as CanonCategory)
          ? f.category
          : "other") as CanonCategory,
        content: f.content!.trim(),
        sourceEpisodeId: episodeId,
      }));

    if (rows.length === 0) return 0;
    await db.insert(canonFacts).values(rows);
    console.log(
      `[Canon] 抽取新增 ${rows.length} 条事实（project=${projectId} episode=${episodeId ?? "-"}）`,
    );
    return rows.length;
  } catch (err) {
    console.error("[Canon] 事实抽取失败:", err);
    return 0;
  }
}
