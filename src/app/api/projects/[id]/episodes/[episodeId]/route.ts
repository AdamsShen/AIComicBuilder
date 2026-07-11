import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  episodes,
  shots,
  characters,
  dialogues,
  storyboardVersions,
  episodeCharacters,
} from "@/lib/db/schema";
import { eq, asc, and, or, isNull, desc, inArray } from "drizzle-orm";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { markDownstreamStale } from "@/lib/staleness";

async function resolveProjectAndEpisode(
  projectId: string,
  episodeId: string,
  userId: string
) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  if (!project) return { project: null, episode: null };

  const [episode] = await db
    .select()
    .from(episodes)
    .where(
      and(eq(episodes.id, episodeId), eq(episodes.projectId, projectId))
    );

  return { project, episode: episode ?? null };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { id, episodeId } = await params;
  const userId = await getUserIdFromRequest(request);
  const { project, episode } = await resolveProjectAndEpisode(
    id,
    episodeId,
    userId
  );

  if (!project || !episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const versionId = url.searchParams.get("versionId") ?? undefined;

  // Fetch versions for this episode
  const allVersions = await db
    .select()
    .from(storyboardVersions)
    .where(
      and(
        eq(storyboardVersions.projectId, id),
        eq(storyboardVersions.episodeId, episodeId)
      )
    )
    .orderBy(desc(storyboardVersions.versionNum));

  const resolvedVersionId = versionId ?? allVersions[0]?.id;

  // Fetch characters linked to this episode via episode_characters table
  const linkedCharIds = await db
    .select({ characterId: episodeCharacters.characterId })
    .from(episodeCharacters)
    .where(eq(episodeCharacters.episodeId, episodeId));

  let epCharacters: typeof characters.$inferSelect[] = [];
  if (linkedCharIds.length > 0) {
    epCharacters = await db
      .select()
      .from(characters)
      .where(inArray(characters.id, linkedCharIds.map((r) => r.characterId)));
  }
  // No links = no characters for this episode (user needs to run character extraction)

  // Fetch shots for this episode + version
  const episodeShots = resolvedVersionId
    ? await db
        .select()
        .from(shots)
        .where(
          and(
            eq(shots.projectId, id),
            eq(shots.episodeId, episodeId),
            eq(shots.versionId, resolvedVersionId)
          )
        )
        .orderBy(asc(shots.sequence))
    : [];

  // Bulk-load ALL shot assets (all versions, not just active) so the UI
  // can render version history arrows and switch between historical fileUrls.
  const { shotAssets } = await import("@/lib/db/schema");
  const { desc: descOrder } = await import("drizzle-orm");
  const assetRows = episodeShots.length
    ? await db
        .select()
        .from(shotAssets)
        .where(inArray(shotAssets.shotId, episodeShots.map((s) => s.id)))
        .orderBy(shotAssets.type, shotAssets.sequenceInType, descOrder(shotAssets.assetVersion))
    : [];
  const assetsByShot = new Map<string, typeof assetRows>();
  for (const row of assetRows) {
    if (!assetsByShot.has(row.shotId)) assetsByShot.set(row.shotId, []);
    assetsByShot.get(row.shotId)!.push(row);
  }

  // Enrich each shot with its dialogues + active asset rows
  const enrichedShots = await Promise.all(
    episodeShots.map(async (shot) => {
      const shotDialogues = await db
        .select({
          id: dialogues.id,
          text: dialogues.text,
          characterId: dialogues.characterId,
          characterName: characters.name,
          sequence: dialogues.sequence,
        })
        .from(dialogues)
        .innerJoin(characters, eq(dialogues.characterId, characters.id))
        .where(eq(dialogues.shotId, shot.id))
        .orderBy(asc(dialogues.sequence));
      const assets = (assetsByShot.get(shot.id) ?? []).map((a) => ({
        id: a.id,
        shotId: a.shotId,
        type: a.type,
        sequenceInType: a.sequenceInType,
        assetVersion: a.assetVersion,
        isActive: a.isActive,
        prompt: a.prompt,
        fileUrl: a.fileUrl,
        status: a.status,
        characters: a.characters ? JSON.parse(a.characters) : null,
        modelProvider: a.modelProvider,
        modelId: a.modelId,
        meta: a.meta ? JSON.parse(a.meta) : null,
      }));
      return { ...shot, dialogues: shotDialogues, assets };
    })
  );

  return NextResponse.json({
    ...episode,
    id: project.id,
    episodeId: episode.id,
    title: project.title,
    idea: episode.idea,
    script: episode.script,
    status: episode.status,
    finalVideoUrl: episode.finalVideoUrl,
    generationMode: episode.generationMode,
    characters: epCharacters,
    shots: enrichedShots,
    versions: allVersions.map((v) => ({
      id: v.id,
      label: v.label,
      versionNum: v.versionNum,
      createdAt:
        v.createdAt instanceof Date
          ? Math.floor(v.createdAt.getTime() / 1000)
          : v.createdAt,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { id, episodeId } = await params;
  const userId = await getUserIdFromRequest(request);
  const { project, episode } = await resolveProjectAndEpisode(
    id,
    episodeId,
    userId
  );

  if (!project || !episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<{
    title: string;
    description: string;
    keywords: string;
    summary: string;
    idea: string;
    script: string;
    outline: string;
    status: "draft" | "processing" | "completed";
    generationMode: "keyframe" | "reference";
    targetDuration: number;
  }>;

  const { title, description, keywords, summary, idea, script, outline, status, generationMode, targetDuration } = body;

  const [updated] = await db
    .update(episodes)
    .set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(keywords !== undefined && { keywords }),
      ...(summary !== undefined && { summary }),
      ...(idea !== undefined && { idea }),
      ...(script !== undefined && { script }),
      ...(outline !== undefined && { outline }),
      ...(status !== undefined && { status }),
      ...(generationMode !== undefined && { generationMode }),
      ...(targetDuration !== undefined && { targetDuration }),
      updatedAt: new Date(),
    })
    .where(eq(episodes.id, episodeId))
    .returning();

  if (script !== undefined) {
    await markDownstreamStale("episode", episodeId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { id, episodeId } = await params;
  const userId = await getUserIdFromRequest(request);
  const { project, episode } = await resolveProjectAndEpisode(
    id,
    episodeId,
    userId
  );

  if (!project || !episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Refuse to delete the last episode
  const allEpisodes = await db
    .select()
    .from(episodes)
    .where(eq(episodes.projectId, id));

  if (allEpisodes.length <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last episode" },
      { status: 400 }
    );
  }

  // 删除分集时，一并清理"仅属于该集"的全局角色，避免残留孤儿数据。
  // 关键顺序：先记录该集通过 episode_characters 关联的角色，再删分集
  // （删分集会级联清空这些关联行，以及 episodeId 绑定的角色/分镜/场景/任务），
  // 最后把这些角色里"删后不再被任何分集关联"的删掉。仅项目级、从未关联任何
  // 分集的角色不在 linkedCharIds 内，天然不会被误删。
  db.transaction((tx) => {
    const linkedCharIds = tx
      .select({ characterId: episodeCharacters.characterId })
      .from(episodeCharacters)
      .where(eq(episodeCharacters.episodeId, episodeId))
      .all()
      .map((r) => r.characterId);

    tx.delete(episodes).where(eq(episodes.id, episodeId)).run();

    if (linkedCharIds.length > 0) {
      // 删分集后仍存在关联的角色 = 被其它分集共享，需保留
      const stillLinked = new Set(
        tx
          .select({ characterId: episodeCharacters.characterId })
          .from(episodeCharacters)
          .where(inArray(episodeCharacters.characterId, linkedCharIds))
          .all()
          .map((r) => r.characterId)
      );
      const orphanCharIds = linkedCharIds.filter((cid) => !stillLinked.has(cid));
      if (orphanCharIds.length > 0) {
        // 角色行删除时，其对话/关系/服装/关联行按外键级联一并清理
        tx.delete(characters).where(inArray(characters.id, orphanCharIds)).run();
      }
    }
  });

  return new NextResponse(null, { status: 204 });
}
