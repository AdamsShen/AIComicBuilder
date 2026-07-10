"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth/client";
import { useModelStore, type ModelConfigSnapshot } from "@/stores/model-store";
import { apiFetch } from "@/lib/api-fetch";

const SAVE_DEBOUNCE_MS = 800;

// 记录本地模型配置的归属用户 id（独立于 model-store 的 persist，不随配置发往服务端）。
// 用于共享浏览器场景防止把上一账号残留的凭证迁移进新账号。
const OWNER_KEY = "model-store-owner";

/** 读取当前模型配置的整份快照。 */
function readSnapshot(): ModelConfigSnapshot {
  const s = useModelStore.getState();
  return {
    providers: s.providers,
    defaultTextModel: s.defaultTextModel,
    defaultImageModel: s.defaultImageModel,
    defaultVideoModel: s.defaultVideoModel,
  };
}

/**
 * 模型配置的服务端同步层（全局挂载，返回 null）。
 * - 登录后从服务端拉取配置并覆盖本地（服务端权威）；服务端为空但本地有配置时首次上云。
 * - 本地变更防抖后整份 PUT 到服务端。
 * - 未登录：不发任何请求，维持 localStorage 行为不变。
 */
export function ModelConfigSync() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;

  // 已保存到服务端的配置快照 JSON：用于跳过 hydrate 回声与无变化保存
  const lastSavedRef = useRef<string | null>(null);
  // 本账号首次加载是否完成：完成前不触发保存
  const loadedRef = useRef(false);

  // 登录后加载（服务端权威）；服务端为空但本地有配置则迁移上云
  useEffect(() => {
    if (isPending) return;
    loadedRef.current = false;
    lastSavedRef.current = null;
    if (!userId) return; // 未登录：保持 localStorage 行为

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/model-config");
        const { config } = (await res.json()) as {
          config: ModelConfigSnapshot | null;
        };
        if (cancelled) return;

        if (config && Array.isArray(config.providers)) {
          // 服务端有配置 → 覆盖本地，并标记归属
          useModelStore.getState().hydrateFromServer(config);
          localStorage.setItem(OWNER_KEY, userId);
          lastSavedRef.current = JSON.stringify(readSnapshot());
        } else {
          // 服务端为空：仅当本地配置归属当前用户（或从未被任何账号认领）时才迁移上云；
          // 否则视为他人残留，清空本地以防跨账号密钥泄漏。
          const owner = localStorage.getItem(OWNER_KEY);
          const ownedByCurrent = owner === null || owner === userId;
          const local = readSnapshot();

          if (ownedByCurrent && local.providers.length > 0) {
            await apiFetch("/api/model-config", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(local),
            });
            lastSavedRef.current = JSON.stringify(local);
          } else if (!ownedByCurrent) {
            // 他人残留 → 清空本地，避免把其 apiKey/secretKey 写入当前账号
            useModelStore.getState().hydrateFromServer({
              providers: [],
              defaultTextModel: null,
              defaultImageModel: null,
              defaultVideoModel: null,
            });
            lastSavedRef.current = JSON.stringify(readSnapshot());
          } else {
            // 归属当前用户但本地为空，无需迁移
            lastSavedRef.current = JSON.stringify(local);
          }
          localStorage.setItem(OWNER_KEY, userId);
        }
      } catch {
        // 加载失败：静默降级用本地缓存
        lastSavedRef.current = JSON.stringify(readSnapshot());
      } finally {
        if (!cancelled) loadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, userId]);

  // 变更防抖保存（仅登录、且首次加载完成后）
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsub = useModelStore.subscribe(() => {
      if (!loadedRef.current) return; // 跳过 hydrate 自身触发的回声
      const current = JSON.stringify(readSnapshot());
      if (current === lastSavedRef.current) return; // 无实质变化
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await apiFetch("/api/model-config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: current,
          });
          lastSavedRef.current = current;
        } catch {
          // 保存失败：忽略，下次变更会再次触发
        }
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [userId]);

  return null;
}
