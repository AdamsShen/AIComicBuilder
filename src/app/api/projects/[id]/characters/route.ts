import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";
import { id as genId } from "@/lib/id";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const result = await db
    .select()
    .from(characters)
    .where(eq(characters.projectId, projectId));
  return NextResponse.json(result);
}

/** 手动新增一个项目级角色（全局共享记忆的一部分）。 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!(await assertProjectOwnership(request, projectId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    name: string;
    gender: string;
    description: string;
    visualHint: string;
    relationToLead: string;
    scope: string;
    heightCm: number;
    bodyType: string;
    performanceStyle: string;
    episodeId: string | null;
  }>;

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "角色名不能为空" }, { status: 400 });
  }
  const scope: "main" | "guest" = body.scope === "guest" ? "guest" : "main";

  const [created] = await db
    .insert(characters)
    .values({
      id: genId(),
      projectId,
      name,
      gender: body.gender ?? "",
      description: body.description ?? "",
      visualHint: body.visualHint ?? "",
      relationToLead: body.relationToLead ?? "",
      scope,
      heightCm: body.heightCm ?? 0,
      bodyType: body.bodyType ?? "average",
      performanceStyle: body.performanceStyle ?? "",
      episodeId: scope === "main" ? null : body.episodeId ?? null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
