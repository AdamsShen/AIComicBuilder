import { db } from "@/lib/db";
import { importLogs } from "@/lib/db/schema";
import { id as genId } from "@/lib/id";

export async function addImportLog(
  projectId: string,
  step: number,
  status: "running" | "done" | "error",
  message: string,
  metadata?: unknown
) {
  await db.insert(importLogs).values({
    id: genId(),
    projectId,
    step,
    status,
    message,
    metadata: metadata ?? {},
  });
}

export const CHUNK_SIZE = 10000;

// 分块 AI 调用的并发上限：避免一次性并发几十个请求触发限流/超时
export const CHUNK_CONCURRENCY = 4;

/**
 * 有并发上限地并行处理数组：同一时刻最多 limit 个任务在跑，返回结果与输入同序。
 * 任一任务 reject 则整体 reject（与调用方现有的 try/catch 语义一致）。
 *
 * 输入输出示例：
 *   mapWithConcurrency([a,b,c,d,e], 2, fn) → 同时最多跑 2 个，结果 [fa,fb,fc,fd,fe]
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Split text at paragraph boundaries, each chunk ≤ CHUNK_SIZE chars */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "txt":
      return buffer.toString("utf-8");
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "pdf": {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      });
      return result.text;
    }
    case "md":
    case "markdown":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}
