import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonFacts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";
import { CANON_CATEGORIES, type CanonCategory } from "@/lib/canon/facts";

/** 编辑一条设定事实（content / category）。 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; factId: string }> },
) {
  const { id: projectId, factId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    category: string;
    content: string;
  }>;

  const updateData: Partial<{ category: CanonCategory; content: string }> = {};
  if (body.content !== undefined) {
    const content = body.content.trim();
    if (!content) {
      return NextResponse.json({ error: "事实内容不能为空" }, { status: 400 });
    }
    updateData.content = content;
  }
  if (
    body.category !== undefined &&
    CANON_CATEGORIES.includes(body.category as CanonCategory)
  ) {
    updateData.category = body.category as CanonCategory;
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "无可更新字段" }, { status: 400 });
  }

  const [updated] = await db
    .update(canonFacts)
    .set(updateData)
    .where(and(eq(canonFacts.id, factId), eq(canonFacts.projectId, projectId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "事实不存在" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** 删除一条设定事实。 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; factId: string }> },
) {
  const { id: projectId, factId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db
    .delete(canonFacts)
    .where(and(eq(canonFacts.id, factId), eq(canonFacts.projectId, projectId)));
  return new NextResponse(null, { status: 204 });
}
