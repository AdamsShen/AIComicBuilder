# 剧集生成多语言处理逻辑

## 三层语言体系

项目中存在三层独立的语言概念，各自由不同机制控制：

| 层级 | 控制方式 | 语言来源 |
|------|---------|---------|
| UI 界面文字 | `next-intl` (`messages/{locale}.json`) | 用户选择的 locale（zh/en/ja/ko） |
| 系统提示词 | `resolvePrompt()` → `registry.ts` 代码默认值 | 硬编码中文 |
| AI 输出内容 | 用户输入字符集自动检测 | 用户输入的创意/剧本语言 |

---

## 支持的语言

```typescript
// src/i18n/routing.ts
locales: ["zh", "en", "ja", "ko"]
defaultLocale: "zh"
```

---

## 各生成环节的语言行为

### 剧本大纲 (`script_outline`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写明"与用户输入语言相同"
- **调用的 prompt builder**：无（直接拼接 `创意构想：${idea}`）
- **调用链**：`resolvePrompt("script_outline")` → `registry.ts` 默认值

### 剧本生成 (`script_generate`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：通过字符集自动检测，显式告知模型
- **调用链**：
  ```
  resolvePrompt("script_generate")           → 系统 prompt
  buildScriptGeneratePrompt(idea)            → 用户 prompt（含语言指令）
    └─ detectLanguage(idea)                  → 字符集检测
  ```

`detectLanguage()` 实现：
```typescript
// src/lib/ai/prompts/script-generate.ts
function detectLanguage(text: string): string {
  if (/[一-鿿]/.test(text)) return "Chinese (中文)";
  if (/[぀-ゟ゠-ヿ]/.test(text)) return "Japanese (日本語)";
  if (/[가-힯]/.test(text)) return "Korean (한국어)";
  return "English";
}
```

生成的用户 prompt 会明确要求模型用检测到的语言输出：
```
OUTPUT LANGUAGE: Japanese (日本語). You MUST write EVERY word of your
output in Japanese (日本語), including all section headers, character
descriptions, stage directions, and dialogue.
```

**例外**：视觉风格和角色描述的字段标签始终是中文（下游解析器依赖）：
```
视觉风格：<值>
色彩基调：<值>
时代美学：<值>
角色：<角色名>
外貌：<值>
...
```

### 剧本解析 (`script_parse`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写明"与原文语言相同"
- **调用链**：`resolvePrompt("script_parse")` + `buildScriptParsePrompt(script)`

### 分集拆分 (`script_split`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中有 `SCRIPT_SPLIT_LANGUAGE_RULES` 写明"与原始素材语言相同"
- **调用位置**：
  - `src/app/api/projects/[id]/upload-script/route.ts`
  - `src/app/api/projects/[id]/import/split/route.ts`

### 角色提取 (`character_extract`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写"所有字段与剧本语言相同，角色名必须与剧本完全一致"
- **调用链**：`resolvePrompt("character_extract")` + `buildCharacterExtractPrompt(script)`

### 导入角色提取 (`import_character_extract`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写"与原文相同语言"
- **区别于 `character_extract`**：用于从上传的完整文本（非剧本格式）中提取角色

### 分镜拆分 (`shot_split`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写"所有文本字段与剧本语言相同。只有 cameraDirection 使用英文技术术语"
- **调用链**：`resolveSlotContents("shot_split")` → `shotSplitDef.buildFullPrompt()`

### 首尾帧提示词生成 (`shot_split_keyframe_assets`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：跟随上游 shot 元数据的语言，无单独语言检测

### 角色四视图 (`character_image`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：跟随上游角色描述的语言
- **特殊**：内含 `themeStyleMappingBlock()` 主题→画风映射表，该表中文关键词用于画风判定
- **调用链**：`buildCharacterTurnaroundPrompt(description, name)`

### 首尾帧生成 (`frame_generate_first` / `frame_generate_last`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：跟随上游 shot 元数据（`sceneDescription`、`startFrameDesc`、`endFrameDesc`）
- **调用链**：`resolveSlotContents("frame_generate_first")` → `buildFirstFramePrompt()`

### 场景参考帧 (`scene_frame_generate` / `ref_image_prompts`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：跟随上游 shot 的语言
- **特殊**：`themeStyleMappingBlock()` 和 `physicsRealismBlock()` 两个共享块始终中文

### 视频生成 (`video_generate` / `ref_video_generate` / `ref_video_prompt`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：`ref_video_prompt` 的 `language_rules` slot 中写"语言跟随剧本：中文剧本→中文提示词，English→English"
- **调用链**：`resolveSlotContents("video_generate")` → `buildVideoPrompt()` 或 `buildReferenceVideoPrompt()`

### 世界观生成 (`world_setting`)

- **系统提示词**：中文，硬编码"中文世界观设定"
- **输出语言**：固定中文（`120-280 字的中文世界观设定`）

### 分集梗概 (`episode_summary`)

- **系统提示词**：硬编码"中文梗概（150字以内）"
- **输出语言**：固定中文

### 设定集提取 (`canon_extract`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写"content 必须与剧本语言一致"

### AI 文本优化 (`ai_optimize_text`)

- **系统提示词**：中文（代码默认值）
- **输出语言**：提示词中写"保持原文语言"

---

## 提示词加载机制

```
resolvePrompt(promptKey, { userId, projectId })
  │
  ├─ 1. 查 DB full-prompt override（scope=project → scope=global）
  │     └─ 命中 → 直接返回，跳过后续
  │
  ├─ 2. 未命中 → 取 registry.ts 代码默认 slot 值
  │
  ├─ 3. 逐 slot 查 DB override（project → global）
  │     └─ 命中 → 覆盖对应 slot
  │
  └─ 4. 调用 def.buildFullPrompt(slotContents) 拼接最终 prompt
```

**重点**：`resolvePrompt()` 目前**不接收 locale 参数**，所有 slot 默认值取自 `registry.ts` 中的中文常量。`default-content.ts` 中的 ja/ko 翻译仅用于**设置页面**的提示词预览展示（`/api/prompt-templates/registry?locale=ja`）。

---

## `default-content.ts` 翻译的作用范围

```typescript
// src/lib/ai/prompts/default-content.ts 注释
/**
 * 所有 prompt slot 的中英默认内容对照表。
 * key 格式: "promptKey.slotKey"
 *
 * 该文件仅定义多语言显示文本；运行时生成始终以 zh 为准。
 */
```

| 用途 | 是否使用翻译 |
|------|------------|
| 设置页提示词预览 | ✅ 是（`?locale=ja` 参数） |
| 实际 AI 生成 | ❌ 否（始终用 registry.ts 中文默认值） |

---

## 共享 Blocks（始终中文）

以下函数返回的提示词片段会被多个 prompt 引用，目前全为中文：

| 函数 | 文件 | 用途 |
|------|------|------|
| `languageRuleBlock()` | `blocks.ts` | 通用的"输出与输入语言一致"规则 |
| `themeStyleMappingBlock()` | `blocks.ts` | 主题→画风自动映射表（仙侠→3D国漫 等） |
| `physicsRealismBlock()` | `blocks.ts` | 物理常识约束（禁止比喻、反物理行为） |
| `artStyleBlock()` | `blocks.ts` | 画风一致性要求 |
| `referenceImageBlock()` | `blocks.ts` | 参考图使用规则 |
| `fidelityPrincipleBlock()` | `blocks.ts` | 上下环节保真度原则 |

---

## 实际效果总结

| 用户操作 | AI 收到的系统提示词 | AI 输出 |
|---------|-------------------|---------|
| UI 切日语 + 中文写创意 | 中文 | 中文 |
| UI 切日语 + 日文写创意 | 中文 | 日文 |
| UI 切韩语 + 韩文写创意 | 中文 | 韩文 |
| UI 切英语 + 英文写创意 | 中文 | 英文 |

> 系统提示词始终中文，输出语言由用户**输入内容的字符集**决定，与 UI 语言设置无关。
