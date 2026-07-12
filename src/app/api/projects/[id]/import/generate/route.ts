import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, episodes, characters, episodeCharacters, characterRelations } from "@/lib/db/schema";
import { eq, and, max } from "drizzle-orm";
import { id as genId } from "@/lib/id";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { addImportLog } from "@/lib/import-utils";

export const maxDuration = 60;

interface EpisodeData {
  title: string;
  description: string;
  keywords: string;
  idea: string;
  characters?: string[];
}

interface CharacterData {
  name: string;
  scope: "main" | "guest";
  description: string;
  visualHint?: string;
  gender?: string;
  relationToLead?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const userId = await getUserIdFromRequest(request);

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    episodes: EpisodeData[];
    characters: CharacterData[];
    relationships?: Array<{
      characterA: string;
      characterB: string;
      relationType: string;
      description?: string;
    }>;
  };

  await addImportLog(
    projectId, 4, "running",
    `开始创建 ${body.episodes.length} 集和 ${body.characters.length} 个角色`
  );

  let created: Array<typeof episodes.$inferSelect> = [];
  let relationCount = 0;
  let newCharCount = 0;

  try {
    // 整个落库放进一个事务：中途任何失败都整体回滚，杜绝"半套脏数据"，
    // 也让失败后的 retry 从干净状态重来。角色/关系按名字与配对去重，
    // 使 retry 或重复导入不会重复堆叠共享的角色名册与关系。
    const result = db.transaction((tx) => {
      // 1. 角色：同名复用既有（幂等），只插入真正新增的
      const existingChars = tx
        .select({ id: characters.id, name: characters.name })
        .from(characters)
        .where(eq(characters.projectId, projectId))
        .all();
      const idByName = new Map<string, string>(
        existingChars.map((c) => [c.name.toLowerCase().trim(), c.id]),
      );
      let createdChars = 0;
      for (const char of body.characters) {
        const key = char.name.toLowerCase().trim();
        if (!key || idByName.has(key)) continue; // 空名或已存在 → 跳过
        const charId = genId();
        tx.insert(characters)
          .values({
            id: charId,
            projectId,
            name: char.name,
            description: char.description,
            visualHint: char.visualHint ?? "",
            gender: char.gender ?? "",
            relationToLead: char.relationToLead ?? "",
            scope: char.scope,
            source: "ai",
            episodeId: null, // 角色现全部为项目级
          })
          .run();
        idByName.set(key, charId);
        createdChars++;
      }

      // 1b. 关系：跳过已存在的同一对（幂等），无自反
      const existingPairs = new Set(
        tx
          .select({
            a: characterRelations.characterAId,
            b: characterRelations.characterBId,
          })
          .from(characterRelations)
          .where(eq(characterRelations.projectId, projectId))
          .all()
          .map((r) => [r.a, r.b].sort().join("|")),
      );
      for (const rel of body.relationships ?? []) {
        const aId = idByName.get(rel.characterA.toLowerCase().trim());
        const bId = idByName.get(rel.characterB.toLowerCase().trim());
        if (!aId || !bId || aId === bId) continue;
        const pairKey = [aId, bId].sort().join("|");
        if (existingPairs.has(pairKey)) continue;
        existingPairs.add(pairKey);
        tx.insert(characterRelations)
          .values({
            id: genId(),
            projectId,
            characterAId: aId,
            characterBId: bId,
            relationType: rel.relationType || "neutral",
            description: rel.description || "",
          })
          .run();
      }

      // 2. 分集：接在现有 max sequence 之后（分集为追加语义，不去重）
      const [seqResult] = tx
        .select({ maxSeq: max(episodes.sequence) })
        .from(episodes)
        .where(eq(episodes.projectId, projectId))
        .all();
      let seq = (seqResult?.maxSeq ?? 0) + 1;
      const createdEps: Array<typeof episodes.$inferSelect> = [];
      for (const ep of body.episodes) {
        const row = tx
          .insert(episodes)
          .values({
            id: genId(),
            projectId,
            title: ep.title,
            description: ep.description || "",
            keywords: ep.keywords || "",
            idea: ep.idea || "",
            sequence: seq++,
          })
          .returning()
          .get();
        createdEps.push(row);
      }

      // 3. episode_characters 关联
      let relCount = 0;
      for (let i = 0; i < body.episodes.length; i++) {
        const epData = body.episodes[i];
        const episodeId = createdEps[i]?.id;
        if (!episodeId || !epData.characters) continue;
        for (const charName of epData.characters) {
          const charId = idByName.get(charName.toLowerCase().trim());
          if (!charId) continue;
          tx.insert(episodeCharacters)
            .values({ id: genId(), episodeId, characterId: charId })
            .run();
          relCount++;
        }
      }

      return { createdEps, relCount, createdChars };
    });

    created = result.createdEps;
    relationCount = result.relCount;
    newCharCount = result.createdChars;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await addImportLog(projectId, 4, "error", `创建失败（已回滚，可安全重试）: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await addImportLog(
    projectId, 4, "done",
    `导入完成！新建 ${newCharCount} 个角色（含复用共 ${body.characters.length}）和 ${created.length} 集（${relationCount} 个角色分配）`,
    { episodeCount: created.length, characterCount: body.characters.length }
  );

  return NextResponse.json({
    episodes: created,
    characterCount: body.characters.length,
  }, { status: 201 });
}
