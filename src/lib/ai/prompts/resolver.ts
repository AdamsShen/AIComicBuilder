import { db } from "@/lib/db";
import { promptTemplates } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getPromptDefinition, getDefaultSlotContents } from "./registry";
import { DEFAULT_CONTENT } from "./default-content";

interface ResolveOptions {
  userId: string;
  projectId?: string;
  /** UI locale — when set, untranslated slots fall back to their locale-specific default */
  locale?: string;
}

/**
 * 查询某 slot 在指定 locale 下的翻译默认内容。
 * 无 locale、为 zh、或该 locale 无翻译时返回 undefined（由调用方回退到代码默认值）。
 */
function getLocaleDefaultContent(
  promptKey: string,
  slotKey: string,
  locale?: string
): string | undefined {
  if (!locale || locale === "zh") return undefined;
  const contentKey = `${promptKey}.${slotKey}`;
  return (DEFAULT_CONTENT[contentKey] as Record<string, string> | undefined)?.[
    locale
  ];
}

/**
 * 返回指定 locale 的 slot 翻译内容。
 * locale 为空或 zh 时返回 undefined（调用方保留 registry 的中文默认值）；
 * 找不到该 locale 的翻译时也返回 undefined，不回退到 en/zh。
 */
function getLocaleSlotContent(
  promptKey: string,
  slotKey: string,
  locale?: string
): string | undefined {
  if (!locale || locale === "zh") return undefined;
  const contentKey = `${promptKey}.${slotKey}`;
  return (
    DEFAULT_CONTENT[contentKey] as Record<string, string> | undefined
  )?.[locale];
}

/**
 * Resolve a prompt's system content by merging:
 *   project-level overrides > global overrides > code defaults
 */
export async function resolvePrompt(
  promptKey: string,
  options: ResolveOptions
): Promise<string> {
  const def = getPromptDefinition(promptKey);
  if (!def) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  const slotContents = getDefaultSlotContents(promptKey) ?? {};

  // Check for full-prompt override first (advanced mode, slotKey = null)
  const fullOverrides = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.userId, options.userId),
        eq(promptTemplates.promptKey, promptKey),
        isNull(promptTemplates.slotKey)
      )
    );

  // Find project-level full override, then global
  const projectFull = fullOverrides.find(
    (o) => o.scope === "project" && o.projectId === options.projectId
  );
  const globalFull = fullOverrides.find((o) => o.scope === "global");

  if (options.projectId && projectFull) {
    return projectFull.content;
  }
  if (globalFull) {
    return globalFull.content;
  }

  // No full override — resolve slot by slot
  const slotOverrides = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.userId, options.userId),
        eq(promptTemplates.promptKey, promptKey)
      )
    );

  for (const slotKey of Object.keys(slotContents)) {
    // Project-level slot override
    if (options.projectId) {
      const projectSlot = slotOverrides.find(
        (o) =>
          o.slotKey === slotKey &&
          o.scope === "project" &&
          o.projectId === options.projectId
      );
      if (projectSlot) {
        slotContents[slotKey] = projectSlot.content;
        continue;
      }
    }
    // Global slot override
    const globalSlot = slotOverrides.find(
      (o) => o.slotKey === slotKey && o.scope === "global"
    );
    if (globalSlot) {
      slotContents[slotKey] = globalSlot.content;
      continue;
    }
    // No override — fall back to locale-specific default if available
    if (options.locale && options.locale !== "zh") {
      const contentKey = `${promptKey}.${slotKey}`;
      const translated = (
        DEFAULT_CONTENT[contentKey] as Record<string, string> | undefined
      )?.[options.locale];
      if (translated) {
        slotContents[slotKey] = translated;
      }
    }
  }

  return def.buildFullPrompt(slotContents);
}

/**
 * Resolve slot contents without building the full prompt.
 * Used for prompts that need dynamic parameters (frame, video, etc.)
 */
export async function resolveSlotContents(
  promptKey: string,
  options: ResolveOptions
): Promise<Record<string, string>> {
  const def = getPromptDefinition(promptKey);
  if (!def) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  const slotContents = getDefaultSlotContents(promptKey) ?? {};

  const overrides = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.userId, options.userId),
        eq(promptTemplates.promptKey, promptKey)
      )
    );

  for (const slotKey of Object.keys(slotContents)) {
    if (options.projectId) {
      const projectSlot = overrides.find(
        (o) =>
          o.slotKey === slotKey &&
          o.scope === "project" &&
          o.projectId === options.projectId
      );
      if (projectSlot) {
        slotContents[slotKey] = projectSlot.content;
        continue;
      }
    }
    const globalSlot = overrides.find(
      (o) => o.slotKey === slotKey && o.scope === "global"
    );
    if (globalSlot) {
      slotContents[slotKey] = globalSlot.content;
      continue;
    }
    // No override — fall back to locale-specific default if available
    if (options.locale && options.locale !== "zh") {
      const contentKey = `${promptKey}.${slotKey}`;
      const translated = (
        DEFAULT_CONTENT[contentKey] as Record<string, string> | undefined
      )?.[options.locale];
      if (translated) {
        slotContents[slotKey] = translated;
      }
    }
  }

  return slotContents;
}
