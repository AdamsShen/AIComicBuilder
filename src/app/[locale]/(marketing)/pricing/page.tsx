import { PricingHeader } from "@/components/pricing/pricing-header";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { FAQSection } from "@/components/pricing/faq-section";
import { getSession } from "@/lib/auth/get-session";
import { hasActivePlan } from "@/lib/entitlement";
import { redirect } from "next/navigation";

export default async function PricingPage() {
  // 已登录且已有套餐（免费或 Pro）→ 直接进项目页；未登录或未选套餐 → 停留选择
  const session = await getSession();
  if (session?.user && (await hasActivePlan(session.user.id))) {
    redirect("/");
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[--surface] via-transparent to-transparent pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <PricingHeader />
        <PricingPlans />
        <FAQSection />
      </div>
    </div>
  );
}
