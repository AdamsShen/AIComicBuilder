# 跨分集记忆 —— 触发规则与实现原理

> 本文档说明「跨分集记忆」两大机制的**触发时机、规则与原理**：
> 1. **全局记忆注入**（世界观 + 全项目角色名册 + 前情提要，注入到生成提示词）
> 2. **本集梗概（前情提要）自动生成**
>
> 目的：让后续分集生成时"记住"前面分集的角色、剧情与世界观，避免每集凭空另造主角、断开剧情。

---

## 一、解决的问题

早期实现里，生成第 N 集的大纲/剧本时**只用了本集的创意构思**，完全不读项目已有角色和前面分集的剧情。结果第 2 集会凭空造新主角、世界观也不延续。现有的"角色去重"只能按名字合并，兜不住"新故事造新人物"。

本机制在**生成环节**把"世界观 + 角色名册 + 前情提要"作为提示词前缀喂给 AI，并明确指令"沿用既有主角及家人、不得替换"，从根上解决延续性问题。

---

## 二、机制一：全局记忆注入

### 2.1 记忆内容的构造

核心函数：`buildEpisodeMemoryContext(projectId, currentEpisodeId?)`
文件：`src/lib/ai/memory-context.ts`

返回**一段字符串前缀**，由三块拼成（任一为空则跳过该块；三块全空返回 `""`）：

| 块 | 数据来源 | 说明 |
|---|---|---|
| **世界观设定** | `projects.world_setting` | 项目级全局设定 |
| **全项目角色名册** | 该项目全部 `characters`（名字 / 性别 / 与主角关系 / 描述） | 主角优先排序；附指令"必须沿用既有角色，尤其主角及其家人，不得替换或另造主角" |
| **前情提要** | 同项目、`sequence < 当前集` 且 `summary` 非空的 `episodes.summary` | 按集号排序，逐条"第N集《标题》：梗概" |

**长度上限**（防止角色多 / 集数多导致 prompt 爆长、token 失控）：
- 名册：最多 `40` 个角色，单角色描述截断到 `100` 字，超出附"另有 N 个角色未列出"
- 前情：最多回溯最近 `6` 集，单集梗概截断到 `200` 字

### 2.2 注入方式

- **前缀拼接到 user prompt 最前面**（不改 system 提示词），与项目原有的 `worldSetting` 注入方式一致。
- 分镜阶段用 `providerOptions.json_object` 强制 JSON 输出 + `extractJSON` 兜底，中文前缀作为上下文**不破坏 JSON 解析**。

### 2.3 触发规则：哪些生成动作注入、各注入哪些块（按界面裁剪）

记忆分三块（世界观 / 角色名册 / 前情提要），**不同界面按契约取子集**（避免把叙事用的记忆硬塞进逐镜头视觉界面、与其"严格按参考图"等强约束冲突）。通过 `buildEpisodeMemoryContext` 的第三个参数 `opts` 控制。

| 生成动作 | 界面操作 | 注入的块 | 名册措辞 |
|---|---|---|---|
| `script_outline` | 生成大纲 | 世界观 + 名册 + 前情 | generate |
| `script_generate` | 生成剧本 | 世界观 + 名册 + 前情 | generate |
| `shot_split` | 分镜拆分 | 世界观 + 名册 + 前情 | generate |
| `ai_optimize_text` | 创意构思·优化提示词 | 世界观 + 名册 + 前情 | generate |
| `generate_keyframe_prompts` | 首尾帧提示词 | 世界观 + 名册（**无前情**） | generate |
| `generate_ref_prompts` | 参考帧提示词 | 世界观 + 名册（**无前情**） | generate |
| `single_video_prompt` / `batch_video_prompt` | 视频提示词 | **仅世界观**（无名册/前情） | — |
| `character_extract` | 角色解析 | **仅名册**（无世界观/前情） | **extract** |

裁剪依据：
- **视频提示词**：其 `@图片N` 契约已精确锚定"本镜头有参考图的角色/场景"，注入 40 人名册会与"严禁引用不在场角色"冲突 → 只留世界观定基调。
- **首尾帧/参考帧**：世界观（画风/设定）有价值，名册有助一致；前情对逐镜头无关 → 去前情。
- **角色解析**：世界观/前情与"抽取"无关（纯烧 token）；名册用 `extract` 措辞（仅供命名对齐/去重，以本集剧本实际登场为准，不强制沿用、不臆造）。
- **世界观块**有字符上限 `MAX_WORLD`，防止成熟项目每次调用塞入过长文本。

> 纯出图 / 出视频 / 合成等动作**不注入**（它们只消费已生成好的提示词，不产生"剧集相关文本"）。

### 2.4 内联 + 异步两套（同一动作两条代码路径，都已注入）

叙事类动作（大纲/分镜/角色解析）在项目里有两份实现，**都要注入**：
- **内联版**：`src/app/api/projects/[id]/generate/route.ts`，前端直接调、流式返回。
- **异步版**：`src/lib/pipeline/*`，走后台任务队列（导入/批量时触发）。

> 说明：剧本（script_generate）、首尾帧/参考帧/视频提示词、创意优化等**只有内联版**（无异步 pipeline）；智能体（bailian/dify/coze）分支对 ref/keyframe **不注入**（其输入是 JSON 结构化载荷，前置中文前缀会破坏解析）。具体行号以 `grep buildEpisodeMemoryContext` 为准，不在此固化。


### 2.5 生效条件

- `episodeId` 存在时，前情提要只取"该集之前"的分集梗概；不存在（项目级生成）时取全部有梗概的分集。
- 世界观 / 角色 / 前情三块**任一有内容即注入对应块**；全空则前缀为空字符串，等价于不注入。

---

## 三、机制二：本集梗概（前情提要）自动生成

本集梗概是"喂给下一集的记忆原料"，需要先有内容，机制一的前情提要才有东西可注入。

### 3.1 触发规则

**自动触发时机：剧本生成（`script_generate`）完成的那一刻**，不是分镜完成后。

具体挂在 `handleScriptGenerate`（`src/app/api/projects/[id]/generate/route.ts`）的两条路径：
- 模型直连路径的 `streamText().onFinish`（`~:626`）—— 剧本流式输出结束、`script` 落库之后
- 智能体（bailian/dify/coze）路径的 `flush`（`~:560`）—— 同理

调用形态：`void autoGenerateEpisodeSummary(episodeId, script, modelConfig)`

**关键条件 / 特性**：
1. **后台异步、不阻塞**（用 `void` 不 await）——剧本框先出完，梗概过几秒才写入 `episodes.summary`，前端需**刷新**才能看到。
2. **仅分集模式**触发（`episodeId` 存在）；项目级生成剧本不生成梗概。
3. **需已配置文本模型**（`modelConfig.text`）；否则 `autoGenerateEpisodeSummary` 提前返回，静默跳过（不报错）。
4. **全程 best-effort**：内部 try/catch，失败只记日志，绝不影响剧本主流程。

### 3.2 不会自动触发的情况

- 生成**大纲**（`script_outline`）后 —— 不触发
- **分镜拆分**（`shot_split`）后 —— 不触发
- **手动敲/粘贴剧本**（直接改文本框 PATCH 保存）—— 不触发（只有走 AI 的 `script_generate` 动作才触发）

### 3.3 手动生成 / 重新生成

- 剧本编辑页「本集梗概」旁的**「生成梗概」按钮** → `episode_summary` action（`generate/route.ts` 的 `handleEpisodeSummary`，`~:207` 分发），按当前剧本重新生成。
- 也可直接在梗概文本框里**手动编辑**保存（PATCH `episodes.summary`）。
- `handleEpisodeSummary` 会校验该分集确属当前（已鉴权）项目，防止越权覆盖他项目分集的梗概。

### 3.4 梗概生成的提示词

系统提示词 `EPISODE_SUMMARY_SYSTEM`：把剧本浓缩成一段中文梗概（约 150 字内），聚焦**关键事件、主要角色及关系变化、结尾时人物处境/悬念**；只输出正文。

---

## 四、数据模型（迁移 `0058`）

| 字段 | 表 | 用途 |
|---|---|---|
| `world_setting` | `projects` | 世界观（项目全局，早已存在） |
| `gender` | `characters` | 角色性别（新增） |
| `relation_to_lead` | `characters` | 与主角的关系，自由文本（新增） |
| `summary` | `episodes` | 本集梗概/前情（新增） |

角色为**项目级全局共享**（`characters.project_id`），跨分集复用；后续分集生成时整份进名册。

---

## 五、前端入口（编辑这些"记忆原料"的地方）

| 内容 | 层级 | 入口位置 |
|---|---|---|
| **世界观设定** | 项目全局 | 项目「分集列表页」顶部（`episodes/page.tsx`，挂 `ProjectMemoryEditor`，不传 episodeId → 只显示世界观） |
| **本集梗概/前情提要** | 每集 | 分集「剧本编辑页」**最底部**（`script-editor.tsx`，挂 `ProjectMemoryEditor` 传 episodeId → 只显示梗概 + 「生成梗概」按钮） |
| **角色（含性别/与主角关系）** | 项目全局 | 角色管理页「新增角色」按钮 + 角色卡字段编辑 |

`ProjectMemoryEditor`（`src/components/editor/project-memory-editor.tsx`）按是否传 `episodeId` 分流：无 → 世界观；有 → 本集梗概。

---

## 六、端到端数据流

```
[项目分集列表页] 填「世界观」          → projects.world_setting
[角色页] 手动新增 / AI 抽取角色         → characters（项目级共享，含性别/与主角关系）
[剧本页] 点「生成剧本」→ 剧本落库后
        └─(后台自动)→ autoGenerateEpisodeSummary → episodes.summary（本集梗概）
                                    │
                                    ▼  生成"下一集"的 大纲 / 剧本 / 分镜 时
        buildEpisodeMemoryContext(项目, 当前集)
          = 世界观  +  全项目角色名册  +  之前各集的前情提要
                                    │  作为 user prompt 前缀拼入
                                    ▼
        大纲 / 剧本 / 分镜的 AI 调用 → 复用既有主角及家人、延续剧情
```

---

## 七、关键代码位置索引

| 作用 | 文件 |
|---|---|
| 记忆前缀构造 | `src/lib/ai/memory-context.ts` → `buildEpisodeMemoryContext` |
| 内联版生成 + 注入 + 梗概自动生成 | `src/app/api/projects/[id]/generate/route.ts`（`handleScriptOutlineAction` / `handleScriptGenerate` / `handleShotSplitStream` / `handleEpisodeSummary` / `autoGenerateEpisodeSummary`） |
| 异步版注入 | `src/lib/pipeline/script-outline.ts`、`src/lib/pipeline/shot-split.ts` |
| 数据表 | `src/lib/db/schema.ts`（`characters.gender/relation_to_lead`、`episodes.summary`）；迁移 `drizzle/0058_add_character_memory_fields.sql` |
| 前端编辑入口 | `src/components/editor/project-memory-editor.tsx`、`character-form-dialog.tsx`、`character-card.tsx`；`episodes/page.tsx`、`script-editor.tsx` |
