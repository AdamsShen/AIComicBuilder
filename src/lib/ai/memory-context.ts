import { db } from "@/lib/db";
import { projects, characters, episodes } from "@/lib/db/schema";
import { eq, and, lt, asc } from "drizzle-orm";

// 上限：避免角色多/集数多时前缀过长、token 成本失控（分镜阶段还会逐 chunk 前置）
const MAX_ROSTER = 40; // 名册最多列出的角色数（主角优先）
const MAX_DESC = 100; // 单个角色描述最大字符数
const MAX_RECAP = 6; // 前情提要最多回溯的分集数（取最近的）
const MAX_SUMMARY = 200; // 单集梗概最大字符数

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * 构造"跨分集记忆"的 user prompt 前缀，供后续分集生成大纲/剧本/分镜时注入。
 *
 * 三块（均可空；全空返回 ""）：
 * 1. 世界观设定（projects.worldSetting）
 * 2. 角色名册（项目全部角色：名字/性别/与主角关系/描述），并要求 AI 沿用既有角色、不得替换主角
 * 3. 前情提要（sequence < 当前集 且 summary 非空的分集梗概，按集数排序）
 *
 * @param projectId 项目 id
 * @param currentEpisodeId 当前分集 id；给定时只取其之前的分集梗概，否则取全部有梗概的分集
 * @returns 拼好的前缀字符串（末尾带换行），无内容时为 ""
 */
export async function buildEpisodeMemoryContext(
  projectId: string,
  currentEpisodeId?: string,
): Promise<string> {
  const blocks: string[] = [];

  // --- 世界观 ---
  const [proj] = await db
    .select({ worldSetting: projects.worldSetting })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (proj?.worldSetting && proj.worldSetting.trim()) {
    blocks.push(
      `【世界观设定】\n${proj.worldSetting.trim()}\n\n所有内容必须与此世界观设定保持一致。`,
    );
  }

  // --- 角色名册（项目级全局共享的角色记忆）---
  const chars = await db
    .select({
      name: characters.name,
      gender: characters.gender,
      relationToLead: characters.relationToLead,
      description: characters.description,
      scope: characters.scope,
    })
    .from(characters)
    .where(eq(characters.projectId, projectId));

  if (chars.length > 0) {
    // 主角优先排序，便于 AI 抓住核心人物
    const sorted = [...chars].sort((a, b) =>
      a.scope === b.scope ? 0 : a.scope === "main" ? -1 : 1,
    );
    const shown = sorted.slice(0, MAX_ROSTER);
    const roster = shown
      .map((c) => {
        const meta = [c.gender, c.relationToLead].filter((s) => s && s.trim());
        const metaStr = meta.length ? `（${meta.join("｜")}）` : "";
        const desc = c.description?.trim()
          ? `：${truncate(c.description.trim(), MAX_DESC)}`
          : "";
        return `- ${c.name}${metaStr}${desc}`;
      })
      .join("\n");
    const more =
      sorted.length > MAX_ROSTER
        ? `\n（另有 ${sorted.length - MAX_ROSTER} 个角色未列出）`
        : "";
    blocks.push(
      `【已有角色名册（项目共享）】\n${roster}${more}\n\n生成时必须沿用以上既有角色，尤其是主角及其家人，不得替换或另造主角；仅在剧情确有需要时才引入新角色，且需与既有人物设定不冲突。`,
    );
  }

  // --- 前情提要（前面分集的剧情梗概）---
  let priorEpisodes: { sequence: number; title: string; summary: string | null }[] =
    [];
  if (currentEpisodeId) {
    const [cur] = await db
      .select({ sequence: episodes.sequence })
      .from(episodes)
      .where(eq(episodes.id, currentEpisodeId))
      .limit(1);
    if (cur) {
      priorEpisodes = await db
        .select({
          sequence: episodes.sequence,
          title: episodes.title,
          summary: episodes.summary,
        })
        .from(episodes)
        .where(
          and(
            eq(episodes.projectId, projectId),
            lt(episodes.sequence, cur.sequence),
          ),
        )
        .orderBy(asc(episodes.sequence));
    }
  } else {
    priorEpisodes = await db
      .select({
        sequence: episodes.sequence,
        title: episodes.title,
        summary: episodes.summary,
      })
      .from(episodes)
      .where(eq(episodes.projectId, projectId))
      .orderBy(asc(episodes.sequence));
  }

  const recap = priorEpisodes
    .filter((e) => e.summary && e.summary.trim())
    .slice(-MAX_RECAP)
    .map(
      (e) =>
        `第${e.sequence}集《${e.title}》：${truncate(e.summary!.trim(), MAX_SUMMARY)}`,
    )
    .join("\n");
  if (recap) {
    blocks.push(
      `【前情提要（须延续以下已发生的剧情）】\n${recap}\n\n本集剧情必须承接上述前情，保持人物关系与故事线的连续性。`,
    );
  }

  if (blocks.length === 0) return "";
  return blocks.join("\n\n") + "\n\n";
}
