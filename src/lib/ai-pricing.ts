import { isInTrial } from "@/lib/entitlement";
import { spendFromWallet } from "@/lib/wallet";

/** AI 操作定价（单位：人民币分） */
export const AI_OPERATION_PRICES = {
  script_outline: 10,       // ¥0.10
  script_generate: 50,      // ¥0.50
  script_parse: 20,         // ¥0.20
  character_extract: 20,    // ¥0.20
  shot_split: 30,           // ¥0.30
  character_image: 100,     // ¥1.00
  frame_generate: 200,      // ¥2.00
  video_generate: 500,      // ¥5.00
  episode_summary: 10,      // ¥0.10
  extract_canon: 10,        // ¥0.10
  shot_rewrite: 10,         // ¥0.10
  video_prompt: 20,         // ¥0.20
  ai_optimize_text: 10,     // ¥0.10
  world_setting: 10,        // ¥0.10
  ref_prompts: 20,          // ¥0.20
  keyframe_prompts: 20,     // ¥0.20
  scene_frame: 200,         // ¥2.00
  ref_image: 200,           // ¥2.00
} as const;

export type AIOperationType = keyof typeof AI_OPERATION_PRICES;

/** 获取操作的中文名称，用于扣费记录 */
export function getOperationLabel(type: AIOperationType): string {
  const labels: Record<AIOperationType, string> = {
    script_outline: "剧本大纲生成",
    script_generate: "剧本生成",
    script_parse: "剧本解析",
    character_extract: "角色提取",
    shot_split: "分镜拆分",
    character_image: "角色图片生成",
    frame_generate: "画面（双帧）生成",
    video_generate: "视频生成",
    episode_summary: "分集梗概生成",
    extract_canon: "设定抽取",
    shot_rewrite: "分镜重写",
    video_prompt: "视频提示词生成",
    ai_optimize_text: "AI 文本优化",
    world_setting: "世界观生成",
    ref_prompts: "参考图提示词生成",
    keyframe_prompts: "首尾帧提示词生成",
    scene_frame: "场景参考图生成",
    ref_image: "参考图生成",
  };
  return labels[type];
}

interface ChargeResult {
  /** 是否实际扣费（试用期内返回 false） */
  charged: boolean;
  /** 错误码：INSUFFICIENT_BALANCE | CHARGE_FAILED */
  error?: string;
}

/**
 * 对 AI 操作进行扣费。
 * - 试用期内：跳过扣费，返回 { charged: false }
 * - 试用到期 + 余额不足：返回 { charged: false, error: "INSUFFICIENT_BALANCE" }
 * - 试用到期 + 余额充足：执行扣费，返回 { charged: true }
 *
 * 调用时机：LLM 调用成功后（失败不扣费）。
 * 对于流式接口，应在流启动前调用（无法在流结束后扣费）。
 */
export async function chargeForAIUse(
  userId: string,
  operationType: AIOperationType,
  referenceId?: string,
): Promise<ChargeResult> {
  // 试用期内免费
  const inTrial = await isInTrial(userId);
  if (inTrial) {
    console.log(`[Billing] 试用用户 ${userId}：${operationType} 跳过扣费`);
    return { charged: false };
  }

  const amount = AI_OPERATION_PRICES[operationType];
  const label = getOperationLabel(operationType);

  try {
    await spendFromWallet({
      userId,
      amount,
      description: label,
      referenceId,
      referenceType: "task",
    });
    console.log(`[Billing] 已扣费 ¥${(amount / 100).toFixed(2)}（${label}），用户 ${userId}`);
    return { charged: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "余额不足") {
      console.warn(`[Billing] 余额不足：用户 ${userId} 尝试 ${label}`);
      return { charged: false, error: "INSUFFICIENT_BALANCE" };
    }
    console.error(`[Billing] 扣费失败：用户 ${userId}，${label}：`, err);
    return { charged: false, error: "CHARGE_FAILED" };
  }
}
