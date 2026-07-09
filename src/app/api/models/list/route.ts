import { NextResponse } from "next/server";

interface ListRequest {
  protocol: string;
  baseUrl: string;
  apiKey: string;
  capability?: string;  // "text" | "image" | "video"
}

interface ModelItem {
  id: string;
  name: string;
}

function buildModelsUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, "");
  // If baseUrl already ends with /v1, don't duplicate
  if (url.endsWith("/v1")) {
    return url + "/models";
  }
  return url + "/v1/models";
}

async function fetchModels(baseUrl: string, apiKey: string): Promise<ModelItem[]> {
  const url = buildModelsUrl(baseUrl);
  console.log("[models/list] Fetching:", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { data?: { id: string }[] };
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Unexpected response format: missing data array");
  }
  return data.data.map((m) => ({ id: m.id, name: m.id }));
}

async function fetchGeminiModels(baseUrl: string, apiKey: string): Promise<ModelItem[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  console.log("[models/list] Fetching Gemini:", url.replace(apiKey, "***"));

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { models?: { name: string; displayName?: string }[] };
  if (!data.models || !Array.isArray(data.models)) {
    throw new Error("Unexpected Gemini response format: missing models array");
  }
  return data.models.map((m) => {
    const id = m.name.replace(/^models\//, "");
    return { id, name: m.displayName || id };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ListRequest;

    if (body.protocol === "kling") {
      return NextResponse.json({
        models: [
          { id: "kling-v1", name: "Kling v1" },
          { id: "kling-v1-5", name: "Kling v1.5" },
          { id: "kling-v1-6", name: "Kling v1.6" },
          { id: "kling-v2", name: "Kling v2" },
          { id: "kling-v2-new", name: "Kling v2 New" },
          { id: "kling-v2-1", name: "Kling v2.1" },
          { id: "kling-v2-master", name: "Kling v2 Master" },
          { id: "kling-v2-1-master", name: "Kling v2.1 Master" },
          { id: "kling-v2-5-turbo", name: "Kling v2.5 Turbo" },
        ],
      });
    }

    if (body.protocol === "ucloud-seedance") {
      return NextResponse.json({
        models: [
          { id: "doubao-seedance-1-5-pro-251215", name: "Seedance 1.5 Pro (UCloud)" },
          { id: "doubao-seedance-2-0-260128", name: "Seedance 2.0 (UCloud)" },
        ],
      });
    }

    if (body.protocol === "wan") {
      return NextResponse.json({
        models: [
          { id: "wan2.7-t2v", name: "Wan 2.7 文生视频" },
          { id: "wan2.7-r2v", name: "Wan 2.7 参考生视频" },
          { id: "wan2.6-t2v", name: "Wan 2.6 文生视频" },
          { id: "wan2.6-i2v-flash", name: "Wan 2.6 图生视频 Flash" },
          { id: "wan2.6-i2v", name: "Wan 2.6 图生视频" },
          { id: "wan2.6-r2v", name: "Wan 2.6 参考生视频" },
          { id: "wan2.6-r2v-flash", name: "Wan 2.6 参考生视频 Flash" },
        ],
      });
    }

    if (body.protocol === "dashscope") {
      return NextResponse.json({
        models: [
          { id: "wan2.7-image-pro", name: "Wan 2.7 Image Pro (4K)" },
          { id: "wan2.7-image", name: "Wan 2.7 Image" },
          { id: "qwen-image-2.0-pro", name: "Qwen Image 2.0 Pro" },
          { id: "qwen-image-2.0", name: "Qwen Image 2.0" },
          { id: "qwen-image-max", name: "Qwen Image Max" },
          { id: "qwen-image-plus", name: "Qwen Image Plus" },
          { id: "z-image-turbo", name: "Z-Image Turbo" },
        ],
      });
    }

    if (body.protocol === "fal") {
      const isText = body.capability === "text";
      const isImage = body.capability === "image";
      const isVideo = body.capability === "video";

      // fal.ai 文本模型（通过 OpenRouter 端点，兼容 OpenAI 聊天格式）
      // 模型来源: https://fal.ai/models/openrouter/router/enterprise/llms.txt
      if (isText) {
        return NextResponse.json({
          models: [
            { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5（推荐·支持视觉）" },
            { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6（支持视觉）" },
            { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6（支持视觉）" },
            { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5（支持视觉）" },
            { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5（支持视觉）" },
            { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro（支持视觉）" },
            { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash（支持视觉）" },
            { id: "google/gemini-2.5-flash-preview-09-2025", name: "Gemini 2.5 Flash（支持视觉）" },
            { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro（支持视觉）" },
            { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
            { id: "z-ai/glm-4.7", name: "GLM 4.7（支持视觉）" },
            { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Llama 3.3 Nemotron 49B" },
            { id: "mistralai/ministral-14b-2512", name: "Ministral 14B" },
            { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5" },
          ],
        });
      }

      // fal.ai 图片模型（同步模式: https://fal.run/{model_id}）
      if (isImage) {
        return NextResponse.json({
          models: [
            { id: "fal-ai/flux-2-pro", name: "Flux 2 Pro（推荐）" },
            { id: "fal-ai/flux-pro/v1.1-ultra", name: "Flux Pro v1.1 Ultra" },
            { id: "fal-ai/flux/dev", name: "Flux Dev" },
            { id: "fal-ai/flux/schnell", name: "Flux Schnell（极速）" },
            { id: "fal-ai/recraft-v3", name: "Recraft V3" },
            { id: "fal-ai/stable-diffusion-v3.5-medium", name: "SD 3.5 Medium" },
            { id: "fal-ai/ideogram/v3", name: "Ideogram V3" },
            { id: "fal-ai/hyper-flux-8bit", name: "Hyper Flux 8bit（极速版）" },
          ],
        });
      }

      // fal.ai 视频模型（队列模式: https://queue.fal.run/{model_id}）
      if (isVideo) {
        return NextResponse.json({
          models: [
            { id: "bytedance/seedance-2.0/image-to-video", name: "Seedance 2.0 图生视频（推荐）" },
            { id: "bytedance/seedance-2.0/text-to-video", name: "Seedance 2.0 文生视频" },
            { id: "bytedance/seedance-2.0/reference-to-video", name: "Seedance 2.0 参考生视频" },
            { id: "bytedance/seedance-2.0/fast/image-to-video", name: "Seedance 2.0 Fast 图生视频" },
            { id: "bytedance/seedance-2.0/fast/text-to-video", name: "Seedance 2.0 Fast 文生视频" },
            { id: "bytedance/seedance-2.0/fast/reference-to-video", name: "Seedance 2.0 Fast 参考生视频" },
            { id: "fal-ai/sora-2/image-to-video", name: "Sora 2 图生视频" },
            { id: "fal-ai/sora-2/text-to-video", name: "Sora 2 文生视频" },
            { id: "fal-ai/wan2.1-i2v", name: "Wan 2.1 图生视频" },
            { id: "fal-ai/kling-video/v2/standard/image-to-video", name: "Kling v2 图生视频" },
            { id: "fal-ai/veo-3.1/image-to-video", name: "Veo 3.1 图生视频" },
          ],
        });
      }

      // 未指定 capability 时返回全部
      return NextResponse.json({
        models: [
          { id: "fal-ai/flux/dev", name: "Flux Dev" },
          { id: "fal-ai/flux/schnell", name: "Flux Schnell" },
          { id: "fal-ai/flux-pro/v1.1-ultra", name: "Flux Pro v1.1 Ultra" },
          { id: "fal-ai/sora-2/image-to-video", name: "Sora 2 图生视频" },
          { id: "fal-ai/sora-2/text-to-video", name: "Sora 2 文生视频" },
          { id: "fal-ai/wan2.1-i2v", name: "Wan 2.1 图生视频" },
          { id: "fal-ai/kling-video/v2/standard/image-to-video", name: "Kling v2 图生视频" },
        ],
      });
    }

    if (!body.baseUrl) {
      return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
    }
    if (!body.apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    const models = body.protocol === "gemini"
      ? await fetchGeminiModels(body.baseUrl, body.apiKey)
      : await fetchModels(body.baseUrl, body.apiKey);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[models/list] Error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
