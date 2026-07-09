export const PLANS = {
  free: {
    nameKey: "free.name" as const,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "free.feature1",
      "free.feature2",
      "free.feature3",
      "free.feature4",
    ],
    cta: "free.cta" as const,
    priceIdMonthly: null as string | null,
    priceIdYearly: null as string | null,
    highlight: false,
  },
  pro: {
    nameKey: "pro.name" as const,
    priceMonthly: 19,
    priceYearly: 190,
    features: [
      "pro.feature1",
      "pro.feature2",
      "pro.feature3",
      "pro.feature4",
      "pro.feature5",
      "pro.feature6",
    ],
    cta: "pro.cta" as const,
    priceIdMonthly: process.env.STRIPE_MONTHLY_PRICE_ID || null,
    priceIdYearly: process.env.STRIPE_YEARLY_PRICE_ID || null,
    highlight: true,
  },
};
