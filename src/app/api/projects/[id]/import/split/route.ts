import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createLanguageModel, extractJSON } from "@/lib/ai/ai-sdk";
import type { ProviderConfig } from "@/lib/ai/ai-sdk";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { addImportLog, chunkText } from "@/lib/import-utils";
import { buildScriptSplitPrompt } from "@/lib/ai/prompts/script-split";
import { resolvePrompt } from "@/lib/ai/prompts/resolver";
import { canUseAI } from "@/lib/entitlement";
import { chargeForAIUse } from "@/lib/ai-pricing";

export const maxDuration = 300;

interface SplitEpisode {
  title: string;
  description: string;
  keywords: string;
  idea: string;
  characters?: string[];
}

interface CharacterSummary {
  name: string;
  scope: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    text: string;
    allCharacters: CharacterSummary[];
    modelConfig: { text: ProviderConfig | null };
    locale?: string;
  };

  if (!body.modelConfig?.text) {
    return NextResponse.json({ error: "No text model" }, { status: 400 });
  }

  // 试用到期 + 余额不足 → 禁止使用 AI
  const canUse = await canUseAI(userId);
  if (!canUse) {
    return NextResponse.json(
      { error: "试用已到期且余额不足，请先充值" },
      { status: 402 }
    );
  }

  const chunks = chunkText(body.text);
  const model = createLanguageModel(body.modelConfig.text);
  // locale 优先从 body 显式传参，回退到 apiFetch 自动携带的 x-user-locale header
  const locale = body.locale || request.headers.get("x-user-locale") || undefined;
  const scriptSplitSystem = await resolvePrompt("script_split", { userId, projectId, locale });

  await addImportLog(
    projectId, 3, "running",
    `开始自动分集，共 ${chunks.length} 块`
  );

  // Build character context for prompt
  const allNames = body.allCharacters.map((c) => c.name);
  const charContext = allNames.length > 0
    ? `\n\nAll extracted characters (assign each to ONLY the episodes where they actually appear): ${allNames.join(", ")}`
    : "";

  // 顺序处理各块（而非全块并发）：既天然限制并发，又能把"上一块结尾"作为
  // 连贯性上下文传入、并用累计集数做 episodeOffset，缓解跨块边界把一集切成两半、
  // 以及编号错乱的问题。单块文档（≤CHUNK_SIZE）仍只跑一次，无额外开销。
  const allEpisodes: SplitEpisode[] = [];
  try {
    let prevTail = "";
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      await addImportLog(
        projectId, 3, "running",
        `正在处理第 ${idx + 1}/${chunks.length} 块...`
      );

      // 跨块缝合：上一块结尾仅供理解连贯，明确要求不要为这部分重新分集
      const contextPrefix = prevTail
        ? `【上一段结尾——仅供理解上下文连贯，请勿为这部分内容重新分集】\n…${prevTail}\n\n【以下是本次需要分集的新内容】\n`
        : "";

      const prompt = buildScriptSplitPrompt(
        contextPrefix + chunk + charContext,
        { chunkIndex: idx, totalChunks: chunks.length, episodeOffset: allEpisodes.length }
      );

      const jsonMode = {
        openai: { response_format: { type: "json_object" } },
      };
      const result = await generateText({
        model,
        system: scriptSplitSystem,
        prompt,
        providerOptions: jsonMode,
      });

      let eps: SplitEpisode[];
      try {
        eps = JSON.parse(extractJSON(result.text)) as SplitEpisode[];
        // 扣费（试用期内跳过，LLM 调用成功后执行）
        await chargeForAIUse(userId, "script_parse", projectId);
      } catch {
        console.error(`[ImportSplit] Chunk ${idx + 1} JSON parse failed. Raw output:\n${result.text.slice(0, 500)}...`);
        await addImportLog(
          projectId, 3, "running",
          `第 ${idx + 1} 块 JSON 解析失败，正在重试...`
        );
        const retry = await generateText({
          model,
          system: scriptSplitSystem,
          prompt: prompt + "\n\nIMPORTANT: Return COMPLETE, VALID JSON. Fewer episodes is better than broken JSON.",
          providerOptions: jsonMode,
        });
        eps = JSON.parse(extractJSON(retry.text)) as SplitEpisode[];
        // 扣费（重试成功后执行）
        await chargeForAIUse(userId, "script_parse", projectId);
      }

      allEpisodes.push(...(Array.isArray(eps) ? eps : []));
      prevTail = chunk.slice(-800); // 仅带上一块末尾一小段做连贯上下文，避免上下文膨胀
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await addImportLog(projectId, 3, "error", `分集失败: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await addImportLog(
    projectId, 3, "done",
    `分集完成，共 ${allEpisodes.length} 集`,
    { episodes: allEpisodes }
  );

  return NextResponse.json({ episodes: allEpisodes });
}
