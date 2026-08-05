import { PricingHeader } from "@/components/pricing/pricing-header";
import { FAQSection } from "@/components/pricing/faq-section";
import { GuestCta } from "@/components/pricing/guest-cta";
import { getSession } from "@/lib/auth/get-session";
import { getTrialDurationDays, getTrialStatus, getBalance } from "@/lib/entitlement";
import { Clock, Zap, Wallet } from "lucide-react";
import Link from "next/link";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  const trialDays = getTrialDurationDays();
  const isLoggedIn = !!session?.user;

  let trialStatus: {
    inTrial: boolean;
    expired: boolean;
    daysLeft: number;
    endsAt: Date | null;
  } | null = null;
  let balance = 0;

  if (session?.user?.id) {
    const [trial, bal] = await Promise.all([
      getTrialStatus(session.user.id),
      getBalance(session.user.id),
    ]);
    trialStatus = trial;
    balance = bal;
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[--surface] via-transparent to-transparent pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <PricingHeader />

        {!isLoggedIn ? (
          /* 未登录：引导注册，展示试用信息 */
          <GuestCta trialDays={trialDays} />
        ) : (
          /* 已登录：展示账户状态 + 钱包余额 + 充值入口 */
          <LoggedInSection trialDays={trialDays} trialStatus={trialStatus} balance={balance} locale={locale} />
        )}

        <FAQSection />
      </div>
    </div>
  );
}

/** 已登录用户看到的账户状态区 */
function LoggedInSection({
  trialDays,
  trialStatus,
  balance,
  locale,
}: {
  trialDays: number;
  trialStatus: {
    inTrial: boolean;
    expired: boolean;
    daysLeft: number;
    endsAt: Date | null;
  } | null;
  balance: number;
  locale: string;
}) {
  const balanceYuan = (balance / 100).toFixed(2);
  const inTrial = trialStatus?.inTrial ?? false;
  const daysLeft = trialStatus?.daysLeft ?? 0;

  return (
    <div className="max-w-2xl mx-auto mb-24">
      {/* 试用状态卡片 */}
      <div className="rounded-2xl border border-[--border-subtle] bg-white p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
            <Clock className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[--text-primary]">
              {inTrial
                ? `试用中 · 剩余 ${daysLeft} 天`
                : "试用已到期"}
            </h3>
            <p className="text-sm text-[--text-secondary]">
              {inTrial
                ? "试用期内可免费使用所有 AI 功能"
                : "请充值后继续使用 AI 功能"}
            </p>
          </div>
        </div>

        {/* 钱包余额 */}
        <div className="flex items-center justify-between rounded-xl bg-[--surface] p-4 mb-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-[--text-secondary]" />
            <span className="text-sm text-[--text-secondary]">钱包余额</span>
          </div>
          <span className="font-semibold text-[--text-primary]">¥{balanceYuan}</span>
        </div>

        {/* 充值按钮 */}
        <Link
          href={`/${locale}/wallet`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-medium text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:bg-[#E8573A] hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97]"
        >
          <Zap className="h-4 w-4" />
          充值
        </Link>
      </div>

      {/* 定价说明 */}
      <div className="rounded-2xl border border-[--border-subtle] bg-white p-6">
        <h4 className="font-semibold text-sm text-[--text-primary] mb-4">
          按量计费参考
        </h4>
        <div className="space-y-3 text-sm">
          <PriceRow label="剧本生成" price="¥0.50" />
          <PriceRow label="角色提取" price="¥0.20" />
          <PriceRow label="分镜拆分" price="¥0.30" />
          <PriceRow label="角色图片生成" price="¥1.00" />
          <PriceRow label="画面（双帧）生成" price="¥2.00" />
          <PriceRow label="视频生成" price="¥5.00" />
        </div>
        <p className="mt-4 text-xs text-[--text-muted]">
          试用期内不收取任何费用。实际扣费金额以各功能页面标注为准。
        </p>
      </div>
    </div>
  );
}

function PriceRow({ label, price }: { label: string; price: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[--border-subtle] last:border-0">
      <span className="text-[--text-secondary]">{label}</span>
      <span className="font-medium text-[--text-primary] tabular-nums">{price}</span>
    </div>
  );
}
