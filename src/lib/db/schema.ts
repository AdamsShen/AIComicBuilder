import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  title: text("title").notNull(),
  idea: text("idea").default(""),
  script: text("script").default(""),
  outline: text("outline").default(""),
  status: text("status", {
    enum: ["draft", "processing", "completed"],
  })
    .notNull()
    .default("draft"),
  finalVideoUrl: text("final_video_url"),
  generationMode: text('generation_mode', { enum: ['keyframe', 'reference'] }).notNull().default('keyframe'),
  useProjectPrompts: integer("use_project_prompts").notNull().default(0),
  colorPalette: text("color_palette").default(""),
  worldSetting: text("world_setting").default(""),
  targetDuration: integer("target_duration").default(0),
  bgmUrl: text("bgm_url").default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const episodes = sqliteTable("episodes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sequence: integer("sequence").notNull(),
  idea: text("idea").default(""),
  script: text("script").default(""),
  outline: text("outline").default(""),
  status: text("status", {
    enum: ["draft", "processing", "completed"],
  })
    .notNull()
    .default("draft"),
  generationMode: text("generation_mode", { enum: ["keyframe", "reference"] })
    .notNull()
    .default("keyframe"),
  description: text("description").default(""),
  keywords: text("keywords").default(""),
  // 本集剧情梗概（前情提要）：剧本生成后自动总结，供后续分集生成时作记忆
  summary: text("summary").default(""),
  scriptHash: text("script_hash").default(""),
  colorPalette: text("color_palette").default(""),
  targetDuration: integer("target_duration").default(0),
  bgmUrl: text("bgm_url").default(""),
  finalVideoUrl: text("final_video_url"),
  // 连贯性校验报告（D）：剧本生成后自动比对已确立事实/前情/本集标题，存 JSON 字符串
  coherenceReport: text("coherence_report"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  visualHint: text("visual_hint").default(""),
  // 性别（自由文本：男/女/其他/未知等）
  gender: text("gender").default(""),
  // 与主角的关系（自由文本，如"主角本人"/"主角的父亲"/"宿敌"），用于跨分集角色记忆
  relationToLead: text("relation_to_lead").default(""),
  referenceImage: text("reference_image"),
  referenceImageHistory: text("reference_image_history").default("[]"),
  scope: text("scope", { enum: ["main", "guest"] }).notNull().default("main"),
  performanceStyle: text("performance_style").default(""),
  heightCm: integer("height_cm").default(0),
  bodyType: text("body_type").default("average"),
  isStale: integer("is_stale").notNull().default(0),
  // 角色来源：ai=AI 生成（性别 gender 与关系 relationToLead 应齐全）；
  // manual=用户手动新增（这两项允许留空）。用于区分并对 AI 角色作完整性要求。
  source: text("source", { enum: ["ai", "manual"] }).notNull().default("ai"),
  episodeId: text("episode_id").references(() => episodes.id, {
    onDelete: "cascade",
  }),
});

export const episodeCharacters = sqliteTable("episode_characters", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
});

// 结构化设定集（Canon / Story Bible）：项目级、无损的"已确立事实"层。
// 每条为一个原子事实，剧本生成时原样注入（不再二次总结），用于消除跨集
// 时间线/年龄/道具/关系等硬矛盾。只增不改：抽取只追加，纠错由用户在面板删改。
export const canonFacts = sqliteTable("canon_facts", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // 事实类别：timeline=时间线事件(含年龄) / character=角色定档属性 /
  // prop=关键道具 / location=地点 / faction=派系 / other=其他
  category: text("category", {
    enum: ["timeline", "character", "prop", "location", "faction", "other"],
  })
    .notNull()
    .default("other"),
  // 一条原子事实（原样注入，不截断），如"屠村时阿离10岁；暴雨纵火夜；父亲赤手空拳被铁骑踏死"
  content: text("content").notNull(),
  // 该事实由哪一集确立；手动新增为 null。删集时置空（set null）而非删除事实。
  sourceEpisodeId: text("source_episode_id").references(() => episodes.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const storyboardVersions = sqliteTable("storyboard_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  versionNum: integer("version_num").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  episodeId: text("episode_id").references(() => episodes.id, {
    onDelete: "cascade",
  }),
});

export const scenes = sqliteTable("scenes", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  description: text("description").default(""),
  lighting: text("lighting").default(""),
  colorPalette: text("color_palette").default(""),
  sequence: integer("sequence").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Unified per-shot asset table.
 * One row = one generated artifact (image prompt+file, or video file) bound
 * to a specific shot via shot_id. The `type` column discriminates which
 * generation mode it belongs to:
 *   - 'first_frame' / 'last_frame'  → keyframe mode image assets
 *   - 'reference'                   → reference mode image assets
 *   - 'keyframe_video'              → keyframe mode video output
 *   - 'reference_video'             → reference mode video output
 *
 * Versioning: regenerating the same asset inserts a new row with
 * (asset_version + 1, is_active=1) and flips the previous active row to
 * is_active=0. Active row = "current"; older rows = history.
 *
 * Two modes coexist freely on the same shot — they live in different rows
 * with different `type` values and never collide.
 */
export const shotAssets = sqliteTable("shot_assets", {
  id: text("id").primaryKey(),
  shotId: text("shot_id")
    .notNull()
    .references(() => shots.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "first_frame",
      "last_frame",
      "reference",
      "keyframe_video",
      "reference_video",
    ],
  }).notNull(),
  sequenceInType: integer("sequence_in_type").notNull().default(0),
  assetVersion: integer("asset_version").notNull().default(1),
  isActive: integer("is_active").notNull().default(1),
  prompt: text("prompt").notNull().default(""),
  fileUrl: text("file_url"),
  status: text("status", {
    enum: ["pending", "generating", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  characters: text("characters"), // JSON array
  modelProvider: text("model_provider"),
  modelId: text("model_id"),
  meta: text("meta"), // JSON
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shots = sqliteTable("shots", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  prompt: text("prompt").default(""),
  motionScript: text("motion_script"),
  cameraDirection: text("camera_direction").default("static"),
  duration: integer("duration").notNull().default(10),
  videoScript: text("video_script"),
  videoPrompt: text("video_prompt"),
  transitionIn: text("transition_in").default("cut"),
  transitionOut: text("transition_out").default("cut"),
  episodeId: text("episode_id").references(() => episodes.id, {
    onDelete: "cascade",
  }),
  versionId: text("version_id").references(() => storyboardVersions.id, {
    onDelete: "cascade",
  }),
  sceneId: text("scene_id"),
  compositionGuide: text("composition_guide").default(""),
  focalPoint: text("focal_point").default(""),
  depthOfField: text("depth_of_field").default("medium"),
  soundDesign: text("sound_design").default(""),
  musicCue: text("music_cue").default(""),
  costumeOverrides: text("costume_overrides").default(""),
  isStale: integer("is_stale").notNull().default(0),
  status: text("status", {
    enum: ["pending", "generating", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
});

export const dialogues = sqliteTable("dialogues", {
  id: text("id").primaryKey(),
  shotId: text("shot_id")
    .notNull()
    .references(() => shots.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  audioUrl: text("audio_url"),
  sequence: integer("sequence").notNull().default(0),
  startRatio: text("start_ratio").default("0"),
  endRatio: text("end_ratio").default("1"),
});

export const importLogs = sqliteTable("import_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  step: integer("step").notNull(),
  status: text("status", { enum: ["running", "done", "error"] })
    .notNull()
    .default("running"),
  message: text("message").notNull().default(""),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const promptTemplates = sqliteTable("prompt_templates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  promptKey: text("prompt_key").notNull(),
  slotKey: text("slot_key"),
  scope: text("scope", { enum: ["global", "project"] }).notNull().default("global"),
  projectId: text("project_id"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const promptVersions = sqliteTable("prompt_versions", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => promptTemplates.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const promptPresets = sqliteTable("prompt_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id"),
  promptKey: text("prompt_key").notNull(),
  slots: text("slots", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const characterRelations = sqliteTable("character_relations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  characterAId: text("character_a_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  characterBId: text("character_b_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull().default("neutral"),
  description: text("description").default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const characterCostumes = sqliteTable("character_costumes", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("default"),
  description: text("description").default(""),
  referenceImage: text("reference_image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const moodBoardImages = sqliteTable("mood_board_images", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  annotation: text("annotation").default(""),
  extractedStyle: text("extracted_style").default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shotActions = sqliteTable("shot_actions", {
  id: text("id").primaryKey(),
  shotId: text("shot_id")
    .notNull()
    .references(() => shots.id, { onDelete: "cascade" }),
  characterId: text("character_id"),
  bodyPart: text("body_part").default("full_body"),
  motion: text("motion").notNull().default(""),
  startTime: text("start_time").default("0"),
  endTime: text("end_time").default("0"),
  intensity: text("intensity").default("normal"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const promptAbTests = sqliteTable("prompt_ab_tests", {
  id: text("id").primaryKey(),
  promptKey: text("prompt_key").notNull(),
  variantA: text("variant_a").notNull(),
  variantB: text("variant_b").notNull(),
  shotId: text("shot_id"),
  resultAUrl: text("result_a_url"),
  resultBUrl: text("result_b_url"),
  preferred: text("preferred"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  type: text("type", {
    enum: [
      "script_outline",
      "script_parse",
      "character_extract",
      "character_image",
      "shot_split",
      "frame_generate",
      "video_generate",
      "video_assemble",
    ],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  payload: text("payload", { mode: "json" }),
  result: text("result", { mode: "json" }),
  error: text("error"),
  retries: integer("retries").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  episodeId: text("episode_id").references(() => episodes.id, {
    onDelete: "cascade",
  }),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["script_outline", "script_generate", "script_parse", "character_extract", "shot_split", "keyframe_prompts", "video_prompts", "ref_image_prompts", "ref_video_prompts"],
  }).notNull(),
  platform: text("platform", {
    enum: ["bailian", "dify", "coze"],
  }).notNull().default("bailian"),
  appId: text("app_id").notNull(),
  apiKey: text("api_key").notNull(),
  description: text("description").default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const agentBindings = sqliteTable("agent_bindings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  category: text("category", {
    enum: ["script_outline", "script_generate", "script_parse", "character_extract", "shot_split", "keyframe_prompts", "video_prompts", "ref_image_prompts", "ref_video_prompts"],
  }).notNull(),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
});

// ============================================================
// Auth & Subscription tables (Better Auth + Stripe)
// ============================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  name: text("name"),
  image: text("image"),
  // 用户主动选择的套餐；null=尚未选择（需去定价页选），"free"=已选免费。
  // Pro 状态不写在这里，由订阅/支付宝订单派生（见 getMembership）。
  plan: text("plan", { enum: ["free", "pro"] }),
  // 试用期结束时间；注册时自动设定（TRIAL_DURATION_DAYS 环境变量控制，默认 3 天）。
  // null=未设置（老用户或跳过试用）。试用期内可免费使用所有 AI 功能无需扣费。
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  status: text("status", {
    enum: ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid"],
  }).notNull(),
  interval: text("interval", { enum: ["month", "year"] }).notNull(),
  amount: integer("amount"),
  currency: text("currency"),
  currentPeriodStart: integer("current_period_start", { mode: "timestamp" }).notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }).notNull(),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  canceledAt: integer("canceled_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 支付宝一次性购买会员时长的订单表（与 Stripe 订阅分离，互不影响）。
// 每一行是一次购买；付款成功后回填 period_start/period_end，会员按订单叠加续期。
export const alipayOrders = sqliteTable("alipay_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 我方订单号（传给支付宝的 out_trade_no），全局唯一
  outTradeNo: text("out_trade_no").notNull().unique(),
  // 支付宝交易号 trade_no，付款成功后回填
  alipayTradeNo: text("alipay_trade_no"),
  planKey: text("plan_key").notNull(),
  interval: text("interval", { enum: ["month", "year"] }).notNull(),
  // 金额，单位：人民币「分」（如 138 元存 13800）
  amount: integer("amount").notNull(),
  status: text("status", {
    enum: ["pending", "paid", "closed"],
  }).notNull(),
  periodStart: integer("period_start", { mode: "timestamp" }),
  periodEnd: integer("period_end", { mode: "timestamp" }),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 登录用户的模型配置（Provider + 默认模型），按账号入库，跟着账号走。
// config 为整份配置的 JSON 字符串（对应前端 model-store 的 providers/default*Model）。
// 仅登录用户同步（userId 必为真实用户，故可 FK）；匿名用户仍走 localStorage。
export const userModelConfig = sqliteTable("user_model_config", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  config: text("config").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================
// Wallet tables (account-level balance + recharge + ledger)
// ============================================================

export const walletBalance = sqliteTable("wallet_balance", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const walletRecharges = sqliteTable("wallet_recharges", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  outTradeNo: text("out_trade_no").notNull().unique(),
  provider: text("provider", { enum: ["stripe", "alipay"] }).notNull(),
  providerSessionId: text("provider_session_id"),
  amount: integer("amount").notNull(),
  status: text("status", {
    enum: ["pending", "paid", "failed", "expired"],
  })
    .notNull()
    .default("pending"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const walletRecords = sqliteTable("wallet_records", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["recharge", "spend", "refund", "adjustment"],
  }).notNull(),
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  description: text("description").notNull().default(""),
  referenceId: text("reference_id"),
  referenceType: text("reference_type", {
    enum: ["recharge", "task", "manual"],
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
