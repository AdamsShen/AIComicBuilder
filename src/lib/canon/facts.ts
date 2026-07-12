import { db } from "@/lib/db";
import { canonFacts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export type CanonCategory =
  | "timeline"
  | "character"
  | "prop"
  | "location"
  | "faction"
  | "other";

export const CANON_CATEGORIES: CanonCategory[] = [
  "timeline",
  "character",
  "prop",
  "location",
  "faction",
  "other",
];

/** canon 事实类别 → 中文标题（注入 prompt 与前端分组共用）。 */
export const CANON_CATEGORY_LABEL: Record<string, string> = {
  timeline: "时间线",
  character: "角色设定",
  prop: "关键道具",
  location: "地点",
  faction: "派系",
  other: "其他",
};

export interface CanonFactRow {
  id: string;
  category: string;
  content: string;
}

/** 取项目全部已确立事实（按类别、创建时间排序）。 */
export async function getCanonFacts(projectId: string): Promise<CanonFactRow[]> {
  return db
    .select({
      id: canonFacts.id,
      category: canonFacts.category,
      content: canonFacts.content,
    })
    .from(canonFacts)
    .where(eq(canonFacts.projectId, projectId))
    .orderBy(asc(canonFacts.category), asc(canonFacts.createdAt));
}

/**
 * 把事实清单格式化为按类别分组的纯文本，供 prompt 注入（抽取去重 / 连贯性校验）。
 * 空清单返回 ""。示例：
 *   时间线：\n- 屠村时阿离10岁\n角色设定：\n- 嬴桀45岁
 */
export function formatCanonFacts(
  facts: { category: string; content: string }[],
): string {
  if (facts.length === 0) return "";
  const byCat = new Map<string, string[]>();
  for (const f of facts) {
    if (!byCat.has(f.category)) byCat.set(f.category, []);
    byCat.get(f.category)!.push(f.content);
  }
  return [...byCat.entries()]
    .map(
      ([cat, items]) =>
        `${CANON_CATEGORY_LABEL[cat] ?? cat}：\n${items
          .map((s) => `- ${s}`)
          .join("\n")}`,
    )
    .join("\n");
}
