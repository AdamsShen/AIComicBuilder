import { db } from "@/lib/db";
import { projects, characters, episodes, canonFacts } from "@/lib/db/schema";
import { eq, and, lt, asc } from "drizzle-orm";
import { CANON_CATEGORY_LABEL } from "@/lib/canon/facts";

// 上限：避免角色多/集数多/世界观过长导致前缀爆长、token 成本失控
const MAX_WORLD = 400; // 世界观最大字符数
const MAX_ROSTER = 40; // 名册最多列出的角色数（主角优先）
const MAX_DESC = 100; // 单个角色描述最大字符数
const MAX_RECAP = 6; // 前情提要最多回溯的分集数（取最近的）
const MAX_SUMMARY = 200; // 单集梗概最大字符数
const MAX_CANON = 80; // 已确立事实最多注入条数（超出仅日志告警，不静默截断）

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** 控制注入哪些记忆块，供各生成界面按需裁剪。 */
export interface MemoryContextOptions {
  /** 世界观设定，默认 true */
  world?: boolean;
  /** 角色名册，默认 true */
  roster?: boolean;
  /** 前情提要，默认 true */
  recap?: boolean;
  /** 已确立事实（Canon 设定集），默认 true；无损原样注入 */
  canon?: boolean;
  /** 名册措辞：generate=要求沿用既有角色；extract=仅供命名对齐/去重（默认 generate） */
  mode?: "generate" | "extract";
}

/**
 * 构造"跨分集记忆"的 user prompt 前缀，供后续分集生成时注入。
 *
 * 三块（各可通过 opts 开关，均可空；全空返回 ""）：
 * 1. 世界观设定（projects.worldSetting，超长截断）
 * 2. 角色名册（项目全部角色：名字/性别/与主角关系/描述）
 * 3. 前情提要（sequence < 当前集 且 summary 非空的分集梗概，按集数排序）
 *
 * 不同界面按需取子集：叙事界面（大纲/剧本/分镜/创意优化）注入全部；
 * 视觉界面按契约裁剪（视频提示词只注世界观、首尾帧不注前情、角色解析只注名册）。
 *
 * @param projectId 项目 id
 * @param currentEpisodeId 当前分集 id；给定时只取其之前的分集梗概，否则取全部有梗概的分集
 * @param opts 注入哪些块（默认三块全开、generate 措辞）
 * @returns 拼好的前缀字符串（末尾带换行），无内容时为 ""
 */
export async function buildEpisodeMemoryContext(
  projectId: string,
  currentEpisodeId?: string,
  opts: MemoryContextOptions = {},
): Promise<string> {
  const {
    world = true,
    roster = true,
    recap: includeRecap = true,
    canon = true,
    mode = "generate",
  } = opts;
  const blocks: string[] = [];

  // --- 世界观 ---
  if (world) {
    const [proj] = await db
      .select({ worldSetting: projects.worldSetting })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (proj?.worldSetting && proj.worldSetting.trim()) {
      blocks.push(
        `【世界观设定】\n${truncate(proj.worldSetting.trim(), MAX_WORLD)}\n\n所有内容必须与此世界观设定保持一致。`,
      );
    }
  }

  // --- 角色名册（项目级全局共享的角色记忆）---
  if (roster) {
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
      const rosterText = shown
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
      // 抽取任务：名册仅供命名对齐/去重，须以本集剧本实际登场角色为准，避免误抽或漏抽
      const rosterInstruction =
        mode === "extract"
          ? "以上为项目已有角色，仅用于统一命名与去重参考。请严格依据本集剧本实际登场的角色进行抽取：不要把未在本集剧本出现的既有角色列入，也不要因名册存在而漏抽本集新登场的角色。"
          : "生成时必须沿用以上既有角色，尤其是主角及其家人，不得替换或另造主角；仅在剧情确有需要时才引入新角色，且需与既有人物设定不冲突。";
      blocks.push(
        `【已有角色名册（项目共享）】\n${rosterText}${more}\n\n${rosterInstruction}`,
      );
    }
  }

  // --- 已确立事实（Canon 设定集）：项目级无损事实层，逐条原样注入 ---
  if (canon) {
    const facts = await db
      .select({
        category: canonFacts.category,
        content: canonFacts.content,
      })
      .from(canonFacts)
      .where(eq(canonFacts.projectId, projectId))
      .orderBy(asc(canonFacts.category), asc(canonFacts.createdAt));

    if (facts.length > 0) {
      const shown = facts.slice(0, MAX_CANON);
      if (facts.length > MAX_CANON) {
        // 不静默截断：超限时明确告知丢弃了多少条
        console.warn(
          `[MemoryContext] canon facts 超出上限，注入 ${MAX_CANON}/${facts.length} 条（丢弃 ${facts.length - MAX_CANON}）`,
        );
      }
      // 按类别分组（查询已按 category 排序，Map 保持该顺序）
      const byCat = new Map<string, string[]>();
      for (const f of shown) {
        if (!byCat.has(f.category)) byCat.set(f.category, []);
        byCat.get(f.category)!.push(f.content);
      }
      const canonText = [...byCat.entries()]
        .map(
          ([cat, items]) =>
            `${CANON_CATEGORY_LABEL[cat] ?? cat}：\n${items
              .map((s) => `- ${s}`)
              .join("\n")}`,
        )
        .join("\n");
      blocks.push(
        `【已确立事实·不可矛盾】\n${canonText}\n\n本集所有内容必须与以上已确立事实严格一致，不得改写其中的年龄、时间、天气、死法、道具、关系等既定细节。`,
      );
    }
  }

  // --- 前情提要（前面分集的剧情梗概）---
  let priorEpisodes: { sequence: number; title: string; summary: string | null }[] =
    [];
  if (includeRecap && currentEpisodeId) {
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
  } else if (includeRecap) {
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
