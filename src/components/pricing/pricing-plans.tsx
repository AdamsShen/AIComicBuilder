"use client";

import { useState } from "react";
import { IntervalToggle } from "./interval-toggle";
import { PricingGrid } from "./pricing-grid";
import type { BillingInterval } from "./pricing-header";

/**
 * 定价区（客户端）：统一持有月/年切换状态，并把它同时喂给切换开关与卡片网格。
 * 修复了此前 Header 的开关与 Grid 状态互相独立、导致年付选择不生效的问题。
 * isLoggedIn 由服务端页面下传（而非客户端 useSession），避免 SSR/客户端首帧不一致。
 */
export function PricingPlans({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <>
      <div className="mb-12 flex justify-center">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>
      <PricingGrid interval={interval} isLoggedIn={isLoggedIn} />
    </>
  );
}
