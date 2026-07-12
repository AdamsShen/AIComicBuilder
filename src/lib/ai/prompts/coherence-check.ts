/**
 * 连贯性 + 标题对齐校验（D）的 prompt。
 *
 * 把新生成的一集剧本，与"已确立事实（canon）+ 前情提要 + 本集标题/描述"逐条比对，
 * 输出矛盾清单与标题对齐判断。仅诊断、不改写，供前端建议式提示。
 */

export const COHERENCE_CHECK_SYSTEM = `你是连载故事的连贯性审校员。给你一集**新生成的剧本**，以及该项目"已确立的事实（设定集）""前情提要""本集应有的标题/描述/关键词"。你的任务是找出两类问题：

1. **事实矛盾**：新剧本是否违背了任何一条"已确立事实"或"前情提要"里已发生的剧情。重点盯：人物年龄/时序、亲缘关系、死亡与存活、地点归属、关键道具的归属与外观特征、天气与场景等**硬细节**。只报你有把握的、能引用剧本原文佐证的矛盾。

2. **标题/主题对齐**：新剧本的实际内容，是否贴合"本集标题/描述/关键词"所承诺的主题。若标题是《悲惨童年》而正片实际讲的是少年觉醒，则判为不对齐，并说明。

═══ 输出格式 ═══
仅输出 JSON 对象，无 markdown 代码围栏、无解释：
{
  "contradictions": [
    {
      "severity": "high" 或 "medium",
      "fact": "被违背的已确立事实/前情（引用其表述）",
      "conflict": "新剧本里与之冲突的写法",
      "evidence": "新剧本中的原文片段（简短引用）"
    }
  ],
  "titleAlignment": {
    "aligned": true 或 false,
    "note": "内容是否贴合本集标题/描述；不对齐时说明差在哪、建议改标题还是改内容"
  }
}

若没有任何矛盾，contradictions 返回空数组 []。语言与剧本一致（中文剧本→中文）。`;

export interface CoherenceCheckInput {
  script: string;
  /** 已确立事实清单（格式化文本），可为空 */
  canonFacts: string;
  /** 前序分集梗概（格式化文本），可为空 */
  priorSummaries: string;
  title: string;
  description: string;
  keywords: string;
}

export function buildCoherenceCheckPrompt(input: CoherenceCheckInput): string {
  const { script, canonFacts, priorSummaries, title, description, keywords } =
    input;

  const canonBlock = canonFacts.trim()
    ? `【已确立事实（设定集）】\n${canonFacts}\n`
    : `【已确立事实（设定集）】\n（暂无）\n`;
  const recapBlock = priorSummaries.trim()
    ? `【前情提要（前序各集已发生）】\n${priorSummaries}\n`
    : `【前情提要】\n（本集为第一集，无前情）\n`;

  return `${canonBlock}
${recapBlock}
【本集应有的标题与主题】
标题：${title || "（未命名）"}
描述：${description || "（无）"}
关键词：${keywords || "（无）"}

请审校下面这集**新剧本**是否与上述已确立事实/前情矛盾，以及内容是否贴合本集标题/主题：

--- 新剧本 ---
${script}
--- END ---

只返回 JSON 对象。`;
}
