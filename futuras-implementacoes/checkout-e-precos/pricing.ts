export interface PricingItem {
  id: number;
  name: string;
  price: string;
  period?: string;
  gradient: string;
}

export const packages: PricingItem[] = [
  { id: 1, name: "DROP IN – 1 SESSION SEATTLE", price: "$35.00", gradient: "from-sage-400/60 to-sage-600/40" },
  { id: 2, name: "FIRST 2 SESSIONS SEATTLE", price: "$45.00", gradient: "from-coral-400/50 to-terracotta-400/40" },
  { id: 3, name: "SEATTLE 4 SESSIONS", price: "$120.00", gradient: "from-terracotta-400/50 to-terracotta-600/30" },
  { id: 4, name: "8 SESSIONS", price: "$220.00", gradient: "from-sage-200/60 to-cream-200/80" },
  { id: 5, name: "20 SESSIONS", price: "$450.00", gradient: "from-sage-400/50 to-sage-200/60" },
];

export const memberships: PricingItem[] = [
  { id: 1, name: "4 SESSIONS MEMBERSHIP SEATTLE", price: "$99.00", period: "/month", gradient: "from-coral-400/50 to-coral-500/30" },
  { id: 2, name: "8 SESSIONS MEMBERSHIP SEATTLE", price: "$170.00", period: "/month", gradient: "from-terracotta-400/50 to-terracotta-500/30" },
  { id: 3, name: "UNLIMITED MEMBERSHIP SEATTLE", price: "$195.00", period: "/month", gradient: "from-sage-400/50 to-sage-600/30" },
];

export const giftCards: PricingItem[] = [
  { id: 1, name: "GIFT CARD", price: "$25 – $500", gradient: "from-cream-200 to-sage-200/50" },
];
