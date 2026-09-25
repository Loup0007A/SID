export interface Business {
  id: string;
  name: string;
  description: string | null;
  founder_id: string;
  treasury_balance: number;
  debt_principal: number;
  last_debt_interest_at: string | null;
  share_count: number;
  shares_in_treasury: number;
  share_price: number;
  is_closed: boolean;
  created_at: string;
}

export interface BusinessEmployee {
  user_id: string;
  nickname: string;
  title: string | null;
  salary: number;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  next_payment_at: string;
}

export interface MyEmployment {
  business_id: string;
  business_name: string;
  title: string | null;
  salary: number;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
}

export interface BusinessTransaction {
  id: string;
  business_id: string;
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BusinessSharePricePoint {
  id: string;
  business_id: string;
  price: number;
  recorded_at: string;
}

export interface MyShareholding {
  business_id: string;
  business_name: string;
  quantity: number;
  share_price: number;
}

export interface TaxPoolStatus {
  balance: number;
  last_distributed_at: string;
  next_distribution_at: string;
  vat_rate: number;
  weekly_wealth_tax_rate: number;
}

/** Ligne du marché boursier (list_market_overview) : cours + fondamentaux publiés. */
export interface MarketEntry {
  id: string;
  name: string;
  description: string | null;
  share_price: number;
  share_count: number;
  shares_in_treasury: number;
  treasury_balance: number;
  debt_principal: number;
  change_24h_pct: number;
  revenue_7d: number;
  costs_7d: number;
  profit_7d: number;
  dividends_30d: number;
  equity: number;
  goodwill: number;
  /** valeur intrinsèque estimée d'une action */
  fair_value: number;
}

export interface MarketSettings {
  liquidity_factor: number;
  fee_rate: number;
  admin_fee_per_share: number;
  min_holding_minutes: number;
  tick_minutes: number;
}

/** Résultat de sell_business_shares : la vente peut être partielle si la
 * trésorerie de l'entreprise ne pouvait pas couvrir la quantité demandée. */
export interface SellResult {
  requested: number;
  sold: number;
  net_received: number;
  partial: boolean;
}
