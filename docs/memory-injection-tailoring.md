# 记忆注入：扩展覆盖 + 按界面裁剪 —— 改动说明

> 本文记录"把跨分集记忆注入扩展到更多剧集相关生成、并按界面裁剪注入内容"这一轮的**改动点、原因**，以及**每个模块最终注入了什么、为什么**。
> 机制与触发规则的完整说明见配套文档 [`cross-episode-memory.md`](./cross-episode-memory.md)。

---

## 一、背景与起因

- 初始只在 **大纲 / 剧本 / 分镜** 三处注入"世界观 + 角色名册 + 前情提要"（`buildEpisodeMemoryContext`）。
- 需求升级：**所有与当前项目剧集相关、会调大模型的提示词，都应带上这些上下文**，以保证跨分集的角色/剧情/世界观一致。于是先把注入扩展到：角色解析、创意构思优化、首尾帧提示词、参考帧提示词、视频提示词。
- 随后审查发现：**"三块全量注入所有界面"在视觉界面上会与现有强约束冲突**——尤其视频提示词，它的系统提示是"严格按 `@图片N` 参考图锚定本镜头在场角色/场景、禁止编造人物"，而塞进一份多达 40 人的名册 + 世界观环境描述，方向正好相反，容易诱导模型引用不在场角色、按世界观改写与参考帧不符的环境。
- 结论：**叙事界面该注，视觉界面该省**。改为**按界面裁剪**——每个界面只注入对它有用、且不与其契约冲突的块。

---

## 二、本次改动点（含原因）

| # | 改动 | 原因 |
|---|---|---|
| 1 | 注入扩展到更多动作：角色解析、创意构思优化、首尾帧/参考帧提示词、视频提示词（内联 + 异步两套同步） | 满足"剧集相关提示词都带上下文"的需求 |
| 2 | `buildEpisodeMemoryContext` 增加 `opts` 参数：`{ world?, roster?, recap?, mode? }`，各块可独立开关 | 支持按界面裁剪，避免一刀切 |
| 3 | 世界观块加字符上限 `MAX_WORLD`（400）并截断 | 世界观原是唯一不设上限的块，成熟项目每次调用可能塞入数 KB，是 token 成本/污染的最大杠杆 |
| 4 | 名册措辞按 `mode` 区分：`generate`（要求沿用既有角色）/ `extract`（仅供命名对齐/去重，以本集剧本实际登场为准） | 生成导向的"不得另造主角"指令若注入到**抽取**任务，会诱导误抽名册角色 / 漏抽本集新登场角色 |
| 5 | 异步 pipeline 的角色解析改用 `extractJSON(result)` 再 `JSON.parse` | 原来直接 `JSON.parse`，加长中文前缀后模型更易输出前言/围栏，直接解析会抛错；与内联版对齐 |
| 6 | 批量视频提示词的 `memoryContext` 从"每镜头算一次"提到 `Promise.all` 之前"整批算一次" | 消除 M×(3~4) 次重复 DB 查询 |
| 7 | 前端 `AiOptimizeButton` 增 `episodeId` prop，创意构思优化按钮透传当前分集 id | 让优化时能取到"本集之前"的前情提要 |
| 8 | ref/keyframe 的**智能体分支**保持不注入 | 智能体输入是 `JSON.stringify(...)` 结构化载荷，前置中文前缀会破坏其 JSON 解析（只在内置模型路径注入） |

---

## 三、每个模块注入了什么、为什么（核心）

记忆分三块：**世界观**（画风/设定基调）、**角色名册**（项目全部角色：名字/性别/与主角关系/描述）、**前情提要**（之前各集剧情梗概）。各界面按需取子集：

| 生成动作（界面操作） | 注入的块 | 名册措辞 | 为什么这么裁 |
|---|---|---|---|
| `script_outline`（生成大纲） | 世界观 + 名册 + 前情 | generate | 叙事生成，三块都直接相关，需延续角色与剧情 |
| `script_generate`（生成剧本） | 世界观 + 名册 + 前情 | generate | 同上，剧本必须承接前情、沿用既有角色 |
| `shot_split`（分镜拆分） | 世界观 + 名册 + 前情 | generate | 由剧本拆镜头，仍属叙事，需保持人物与剧情连续 |
| `ai_optimize_text`（创意构思·优化） | 世界观 + 名册 + 前情 | generate | 最契合：把一句创意扩写完整时，世界观/角色/前情都是有效背景 |
| `generate_keyframe_prompts`（首尾帧提示词） | 世界观 + 名册（**去前情**） | generate | 世界观定画风、名册保角色一致；**前情是逐镜头视觉指令用不到的叙事信息** |
| `generate_ref_prompts`（参考帧提示词） | 世界观 + 名册（**去前情**） | generate | 同首尾帧（参考模式对等） |
| `single_video_prompt` / `batch_video_prompt`（视频提示词） | **仅世界观** | — | `@图片N` 契约已精确携带"本镜头有参考图的唯一相关角色/场景"，**注入名册会与"禁止引用不在场角色"直接冲突**；前情对逐镜头视觉指令无用；只留一段（截断的）世界观定基调 |
| `character_extract`（角色解析） | **仅名册** | **extract** | 抽取任务应严格锚定**本集剧本**；名册仅作命名对齐/去重参考；世界观/前情与"抽取"无关，纯烧 token，去掉 |

> 未注入的动作：纯出图 / 出视频 / 视频合成等——它们只消费已生成好的提示词，不产生"剧集相关文本"。

---

## 四、如何调整 / 扩展

`buildEpisodeMemoryContext(projectId, episodeId?, opts?)` 的 `opts`：

```ts
interface MemoryContextOptions {
  world?: boolean;   // 注入世界观，默认 true
  roster?: boolean;  // 注入角色名册，默认 true
  recap?: boolean;   // 注入前情提要，默认 true
  mode?: "generate" | "extract"; // 名册措辞，默认 generate
}
```

- 叙事界面：直接 `buildEpisodeMemoryContext(projectId, episodeId)`（默认三块全开）。
- 视觉/抽取界面：传子集，如视频提示词 `{ roster: false, recap: false }`、角色解析 `{ world: false, recap: false, mode: "extract" }`。
- 新增一个剧集相关生成动作时：判断它是"叙事"还是"逐镜头视觉/抽取"，据此选择注入哪些块。

上限常量（`memory-context.ts` 顶部）：`MAX_WORLD=400`、`MAX_ROSTER=40`、`MAX_DESC=100`、`MAX_RECAP=6`、`MAX_SUMMARY=200`。

---

## 五、涉及文件

- `src/lib/ai/memory-context.ts` —— 新增 `MemoryContextOptions`、按块开关、世界观截断、extract 措辞。
- `src/app/api/projects/[id]/generate/route.ts` —— 各动作按界面传对应 `opts`；批量视频提示词记忆提到循环外。
- `src/lib/pipeline/character-extract.ts` —— 注入（extract 子集）+ 改用 `extractJSON` 容错。
- `src/lib/pipeline/{script-outline,shot-split}.ts` —— 叙事异步版注入（默认三块）。
- `src/components/editor/ai-optimize-button.tsx`、`script-editor.tsx` —— 透传 `episodeId`。

> 校验：`tsc --noEmit` 0 错误；改动行无新增 lint 问题（仅既有告警）。
