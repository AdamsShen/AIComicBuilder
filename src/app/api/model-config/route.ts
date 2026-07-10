import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import { userModelConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 读取当前登录用户的模型配置。
 * 响应：{ config: <JSON对象> | null }（未保存过为 null）
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const [row] = await db
      .select()
      .from(userModelConfig)
      .where(eq(userModelConfig.userId, session.user.id))
      .limit(1);

    // config 存的是整份配置的 JSON 字符串；损坏时视作无配置优雅降级
    let config: unknown = null;
    if (row) {
      try {
        config = JSON.parse(row.config);
      } catch {
        console.error(
          "[ModelConfig GET] corrupt config for user:",
          session.user.id,
        );
        config = null;
      }
    }
    return NextResponse.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ModelConfig GET] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 整份保存（upsert）当前登录用户的模型配置。
 * 请求体：{ providers, defaultTextModel, defaultImageModel, defaultVideoModel }
 * 响应：{ ok: true }
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // 配置 JSON 上限，防止超大写入（256KB 对模型配置绰绰有余）
  const MAX_CONFIG_BYTES = 256 * 1024;

  let config: string;
  try {
    const body = (await request.json()) as unknown;
    // 轻量结构校验：必须是对象且含 providers 数组
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as { providers?: unknown }).providers)
    ) {
      return NextResponse.json({ error: "无效的配置格式" }, { status: 400 });
    }
    config = JSON.stringify(body);
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  if (config.length > MAX_CONFIG_BYTES) {
    return NextResponse.json({ error: "配置过大" }, { status: 413 });
  }

  try {
    const now = new Date();
    await db
      .insert(userModelConfig)
      .values({ userId: session.user.id, config, updatedAt: now })
      .onConflictDoUpdate({
        target: userModelConfig.userId,
        set: { config, updatedAt: now },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ModelConfig PUT] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
