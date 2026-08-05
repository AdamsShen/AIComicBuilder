import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { FingerprintProvider } from "@/components/fingerprint-provider";
import { ModelConfigSync } from "@/components/model-config-sync";
import { DiscordFloat } from "@/components/discord-float";
import { Toaster } from "sonner";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "zh" | "en" | "ja" | "ko")) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <FingerprintProvider>
        <ModelConfigSync />
        {children}
      </FingerprintProvider>
      <DiscordFloat />
      <Toaster position="top-center" theme="dark" />
    </NextIntlClientProvider>
  );
}
