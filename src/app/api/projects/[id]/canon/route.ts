import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonFacts } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";
import { id as genId } from "@/lib/id";
import { CANON_CATEGORIES, type CanonCategory } from "@/lib/canon/facts";

/**
 * 列出设定事实（按类别、创建时间排序）。
 * 可选 ?episodeId=xxx：只返回该分集提取出的事实（source_episode_id 匹配）。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const episodeId = new URL(request.url).searchParams.get("episodeId");
  const where = episodeId
    ? and(
        eq(canonFacts.projectId, projectId),
        eq(canonFacts.sourceEpisodeId, episodeId),
      )
    : eq(canonFacts.projectId, projectId);
  const rows = await db
    .select()
    .from(canonFacts)
    .where(where)
    .orderBy(asc(canonFacts.category), asc(canonFacts.createdAt));
  return NextResponse.json(rows);
}

/** 手动新增一条设定事实（sourceEpisodeId 为空，标识非 AI 抽取）。 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    category: string;
    content: string;
  }>;

  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "事实内容不能为空" }, { status: 400 });
  }
  const category: CanonCategory = CANON_CATEGORIES.includes(
    body.category as CanonCategory,
  )
    ? (body.category as CanonCategory)
    : "other";

  const [created] = await db
    .insert(canonFacts)
    .values({
      id: genId(),
      projectId,
      category,
      content,
      sourceEpisodeId: null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
