import { NextResponse } from "next/server";
import { PROMPT_REGISTRY } from "@/lib/ai/prompts/registry";
import { DEFAULT_CONTENT } from "@/lib/ai/prompts/default-content";

/**
 * 返回 prompt 注册表，可选的 ?locale= 参数用于返回对应语言的默认内容。
 * 默认返回中文（zh）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "zh";

  const registry = PROMPT_REGISTRY.map((def) => ({
    key: def.key,
    nameKey: def.nameKey,
    descriptionKey: def.descriptionKey,
    category: def.category,
    slots: def.slots.map((s) => {
      const contentKey = `${def.key}.${s.key}`;
      const localized = DEFAULT_CONTENT[contentKey];
      // 查找该 locale 的翻译；ja/ko 无翻译时回退到 en（英文）→ zh（中文）→ registry 原始值
      const defaultContent: string =
        (localized as Record<string, string> | undefined)?.[locale] ??
        localized?.en ??
        localized?.zh ??
        s.defaultContent;
      return {
        key: s.key,
        nameKey: s.nameKey,
        descriptionKey: s.descriptionKey,
        defaultContent,
        editable: s.editable,
      };
    }),
  }));
  return NextResponse.json(registry);
}
