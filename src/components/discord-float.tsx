"use client";

import { useTranslations } from "next-intl";
import { DISCORD_INVITE_URL } from "@/lib/discord";

/** Discord 品牌色 */
const DISCORD_BRAND = "#5865F2";

/** 悬浮在页面右侧的 Discord 讨论入口 */
export function DiscordFloat() {
  const t = useTranslations("common");

  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed right-3 top-1/2 z-50 -translate-y-1/2 flex items-center gap-2 rounded-2xl border border-[--border-subtle] bg-white py-2.5 pl-3 pr-3 shadow-lg shadow-black/5 transition-all duration-300 hover:pr-4 hover:shadow-xl hover:shadow-black/8"
      title={t("discordJoin")}
    >
      {/* Discord 图标 */}
      <svg
        className="h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
        viewBox="0 0 127.14 96.36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill={DISCORD_BRAND}
          d="M107.7 8.07A105.15 105.15 0 0081.47 0a72.06 72.06 0 00-3.36 6.83 97.68 97.68 0 00-29.11 0A72.37 72.37 0 0045.64 0a105.89 105.89 0 00-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0032.17 16.15 77.7 77.7 0 006.89-11.11 68.42 68.42 0 01-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0064.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 01-10.87 5.19 77 77 0 006.89 11.1 105.25 105.25 0 0032.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69z"
        />
      </svg>

      {/* 文字 — 默认隐藏，hover 展开 */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium text-[--text-secondary] opacity-0 transition-all duration-300 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-0.5">
        {t("discordJoin")}
      </span>
    </a>
  );
}
