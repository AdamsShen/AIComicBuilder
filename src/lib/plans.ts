export const PLANS = {
  free: {
    nameKey: "pricing.free.name",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "pricing.free.feature1",
      "pricing.free.feature2",
      "pricing.free.feature3",
      "pricing.free.feature4",
    ],
    cta: "pricing.free.cta",
    priceIdMonthly: null as string | null,
    priceIdYearly: null as string | null,
  },
  pro: {
    nameKey: "pricing.pro.name",
    priceMonthly: 19,
    priceYearly: 190,
    features: [
      "pricing.pro.feature1",
      "pricing.pro.feature2",
      "pricing.pro.feature3",
      "pricing.pro.feature4",
      "pricing.pro.feature5",
      "pricing.pro.feature6",
    ],
    cta: "pricing.pro.cta",
    priceIdMonthly: process.env.STRIPE_MONTHLY_PRICE_ID,
    priceIdYearly: process.env.STRIPE_YEARLY_PRICE_ID,
    highlight: true,
  },
};
