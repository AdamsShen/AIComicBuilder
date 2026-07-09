import { PricingHeader } from "@/components/pricing/pricing-header";
import { PricingGrid } from "@/components/pricing/pricing-grid";
import { FAQSection } from "@/components/pricing/faq-section";

export default function PricingPage() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[--surface] via-transparent to-transparent pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <PricingHeader />
        <PricingGrid />
        <FAQSection />
      </div>
    </div>
  );
}
