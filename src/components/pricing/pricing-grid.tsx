"use client";

import { PLANS } from "@/lib/plans";
import { PlanCard } from "./plan-card";
import { useSession } from "@/lib/auth/client";
import type { BillingInterval } from "./pricing-header";

interface PricingGridProps {
  interval?: BillingInterval;
}

export function PricingGrid({ interval = "month" }: PricingGridProps) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto mb-24">
      {Object.entries(PLANS).map(([key, plan]) => (
        <PlanCard
          key={key}
          plan={{
            ...plan,
            key,
          }}
          interval={interval}
          isLoggedIn={isLoggedIn}
        />
      ))}
    </div>
  );
}
