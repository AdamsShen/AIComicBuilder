/** Discord 邀请链接 — 优先使用环境变量，未配置时回退至默认链接 */
export const DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ??
  "https://discord.gg/9rWSXcMvdu";
