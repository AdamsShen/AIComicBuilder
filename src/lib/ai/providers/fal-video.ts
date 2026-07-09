import type { VideoProvider, VideoGenerateParams, VideoGenerateResult } from "../types";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";

function toDataUrl(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/png";
  const base64 = fs.readFileSync(filePath, { encoding: "base64" });
  return `data:${mime};base64,${base64}`;
}

function toImageUrl(imagePathOrUrl: string): string {
  if (imagePathOrUrl.startsWith("http://") || imagePathOrUrl.startsWith("https://")) {
    return imagePathOrUrl;
  }
  return toDataUrl(imagePathOrUrl);
}

/**
 * fal.ai 视频生成 Provider
 *
 * API 格式：POST https://fal.run/{model_id}
 * 认证方式：Authorization: Key <api_key>
 *
 * 支持的模型示例：
 * - fal-ai/sora-2/image-to-video（图生视频）
 * - fal-ai/sora-2/text-to-video（文生视频）
 * - fal-ai/wan2.1-i2v（图生视频）
 */
export class FalVideoProvider implements VideoProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private uploadDir: string;

  constructor(params?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    uploadDir?: string;
  }) {
    this.apiKey = params?.apiKey || process.env.FAL_API_KEY || "";
    this.baseUrl = (params?.baseUrl || process.env.FAL_BASE_URL || "https://queue.fal.run").replace(/\/+$/, "");
    this.model = params?.model || process.env.FAL_VIDEO_MODEL || "fal-ai/sora-2/image-to-video";
    this.uploadDir = params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
  }

  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const url = `${this.baseUrl}/${this.model}`;

    const payload: Record<string, unknown> = {
      prompt: params.prompt,
      num_frames: params.duration || 5,
    };

    // 处理图片输入
    if ("firstFrame" in params && params.firstFrame) {
      payload.image_url = toImageUrl(params.firstFrame);
    } else if ("initialImage" in params && params.initialImage) {
      payload.image_url = toImageUrl(params.initialImage);
    }

    // 处理参考图
    if (params.referenceImages?.length) {
      payload.reference_images = params.referenceImages.map(toImageUrl);
    }

    // 画幅比（如 "16:9"）
    if (params.ratio) {
      payload.aspect_ratio = params.ratio;
    }

    console.log(`[FalVideo] Submitting: model=${this.model}, url=${url}`);

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
      throw new Error(`fal.ai video generation failed: ${response.status} ${errText}`);
    }

    // fal.ai 直接返回结果（同步模式）或返回 request_id（异步）
    const result = (await response.json()) as {
      video?: { url?: string };
      videos?: { url?: string }[];
      request_id?: string;
    };

    const videoUrl = result.video?.url || result.videos?.[0]?.url;

    // 异步模式：需要轮询
    if (!videoUrl && result.request_id) {
      console.log(`[FalVideo] Async mode, polling request_id: ${result.request_id}`);
      const polledUrl = await this.pollForResult(result.request_id);
      const buffer = await this.downloadVideo(polledUrl);
      const filepath = this.saveVideo(buffer);
      return { filePath: filepath };
    }

    if (!videoUrl) {
      throw new Error("fal.ai returned no video URL: " + JSON.stringify(result).slice(0, 500));
    }

    const buffer = await this.downloadVideo(videoUrl);
    const filepath = this.saveVideo(buffer);
    return { filePath: filepath };
  }

  private async downloadVideo(url: string): Promise<Buffer> {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }

  private saveVideo(buffer: Buffer): string {
    const filename = `${genId()}.mp4`;
    const dir = path.join(this.uploadDir, "videos");
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
  }

  private async pollForResult(requestId: string): Promise<string> {
    const maxAttempts = 120;
    const interval = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      // fal.ai 状态查询端点，model 参数用于构建正确的 status URL
      const statusUrl = `https://queue.fal.run/${this.model}/requests/${requestId}/status`;
      const response = await fetch(statusUrl, {
        headers: {
          Authorization: `Key ${this.apiKey}`,
        },
      });

      if (!response.ok) continue;

      const result = (await response.json()) as {
        status: string;
        video?: { url?: string };
        videos?: { url?: string }[];
      };

      console.log(`[FalVideo] Poll ${i + 1}: status=${result.status}`);

      if (result.status === "COMPLETED") {
        const url = result.video?.url || result.videos?.[0]?.url;
        if (url) return url;
        throw new Error("fal.ai video completed but no video URL returned");
      }

      if (result.status === "FAILED") {
        throw new Error("fal.ai video generation failed");
      }
    }

    throw new Error("fal.ai video generation timed out after 10 minutes");
  }
}
