import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoIcon } from "@/components/logo";
import { UserMenu } from "@/components/auth/user-menu";
import Link from "next/link";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-[--border-subtle] bg-white/80 backdrop-blur-xl px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[--primary]/10 text-[--primary]">
            <LogoIcon size={14} />
          </div>
          <span className="font-display text-sm font-semibold text-[--text-primary]">
            {t("appName")}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="flex h-8 items-center rounded-lg px-3 text-xs text-[--text-secondary] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          >
            {t("pricing")}
          </Link>
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
