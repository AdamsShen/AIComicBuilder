import type { AIProvider, TextOptions, ImageOptions } from "../types";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";

/**
 * fal.ai 图片生成 Provider
 *
 * fal.ai 的图片 API 支持两种模式：
 * 1. 同步模式：POST https://fal.run/{model_id}，等待返回
 * 2. 队列模式：POST https://queue.fal.run/{model_id}，提交后轮询
 *
 * 这里使用同步模式，适合生成时间较短的图片任务。
 *
 * fal.ai 认证方式：Authorization: Key <api_key>（注意不是 Bearer）
 * 与 OpenAI 格式：不兼容，是 fal 私有协议
 */
/**
 * 将通用的尺寸/比例参数转为 fal.ai flux 模型支持的 image_size 枚举值。
 * flux-2-pro 接受的格式: square_hd, square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9
 */
function normalizeImageSize(size?: string, aspectRatio?: string): string | undefined {
  const raw = size || aspectRatio || "";
  const mapping: Record<string, string> = {
    "2560x1440": "landscape_16_9",
    "1792x1024": "landscape_16_9",
    "1440x2560": "portrait_16_9",
    "1024x1792": "portrait_16_9",
    "2048x2048": "square_hd",
    "1024x1024": "square",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
    "1:1": "square_hd",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
  };
  return mapping[raw] || undefined;
}

export class FalImageProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private uploadDir: string;

  constructor(params?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    uploadDir?: string;
  }) {
    this.apiKey = params?.apiKey || process.env.FAL_API_KEY || "";
    this.baseUrl = (params?.baseUrl || process.env.FAL_BASE_URL || "https://fal.run").replace(/\/+$/, "");
    this.defaultModel = params?.model || process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev";
    this.uploadDir = params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
  }

  async generateText(prompt: string, options?: TextOptions): Promise<string> {
    // fal.ai 文本生成通过 OpenRouter 端点: POST https://fal.run/openrouter/router/enterprise/v1/chat/completions
    const model = options?.model || "anthropic/claude-sonnet-5";
    const url = `${this.baseUrl}/openrouter/router/enterprise/v1/chat/completions`;

    const messages: Record<string, unknown>[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    // 支持多模态（图片理解）
    if (options?.images?.length) {
      const content: Record<string, unknown>[] = [];
      for (const imgPath of options.images) {
        try {
          const resolved = path.resolve(imgPath);
          if (fs.existsSync(resolved)) {
            const data = fs.readFileSync(resolved).toString("base64");
            const ext = path.extname(resolved).toLowerCase().replace(".", "");
            const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
            content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${data}` } });
          }
        } catch { /* skip unreadable */ }
      }
      content.push({ type: "text", text: prompt });
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    console.log(`[FalText] Generating: model=${model}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`fal.ai text generation failed: ${response.status} ${errText}`);
    }

    const result = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const text = result.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("fal.ai returned no text content: " + JSON.stringify(result).slice(0, 500));
    }

    return text;
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const url = `${this.baseUrl}/${model}`;

    const payload: Record<string, unknown> = { prompt };

    // flux 模型需要 fal.ai 枚举格式的 image_size
    if (model.startsWith("fal-ai/flux")) {
      const falSize = normalizeImageSize(options?.size, options?.aspectRatio);
      if (falSize) {
        payload.image_size = falSize;
      }
    }

    // 图生图参考图（如 flux/dev/image-to-image）
    if (options?.referenceImages?.length) {
      const refUrl = options.referenceImages[0];
      if (refUrl.startsWith("http://") || refUrl.startsWith("https://")) {
        payload.image_url = refUrl;
      } else if (fs.existsSync(refUrl)) {
        const base64 = fs.readFileSync(refUrl, { encoding: "base64" });
        const ext = path.extname(refUrl).toLowerCase().replace(".", "");
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
        payload.image_url = `data:${mime};base64,${base64}`;
      }
    }

    console.log(`[FalImage] Generating: model=${model}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`fal.ai image generation failed: ${response.status} ${errText}`);
    }

    const result = (await response.json()) as {
      images?: { url?: string }[];
      image?: { url?: string };
    };

    // fal.ai 返回格式：{ images: [{ url: "..." }] } 或 { image: { url: "..." } }
    const imageUrl =
      result.images?.[0]?.url ||
      result.image?.url;

    if (!imageUrl) {
      throw new Error("fal.ai returned no image URL: " + JSON.stringify(result).slice(0, 500));
    }

    // 下载图片到本地
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const filename = `${genId()}.png`;
    const dir = path.join(this.uploadDir, "frames");
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    return filepath;
  }
}
