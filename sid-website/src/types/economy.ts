/** Lot 69 : banque centrale, bourse à carnet d'ordres, impôts, frais, litiges. */

export interface EconomyDay {
  day: string;
  price_index: number;
  raw_index: number | null;
  zeni_value: number;
  observations: number;
  items_priced: number;
  money_wallets: number;
  money_bank: number;
  money_treasuries: number;
  money_population: number;
  money_pool: number;
  money_supply: number;
  debt_members: number;
  debt_businesses: number;
  spending_7d: number;
  inflation_30d: number | null;
  money_growth_30d: number | null;
  pressure: number | null;
  policy_rate_weekly: number | null;
  savings_rate_daily: number | null;
  loan_rate_daily: number | null;
  wealth_tax_rate: number | null;
  corporate_tax_rate: number | null;
  wealth_allowance: number | null;
  bankruptcy_threshold: number | null;
  max_debt: number | null;
  max_business_debt: number | null;
  auto: boolean;
}

export interface EconomyOverview {
  today: EconomyDay | null;
  auto: boolean;
  target_30d: number;
  vat_rate: number;
  series: { day: string; index: number; zeni: number; m: number; inflation: number | null; policy: number | null; spending: number }[];
  basket: { name: string; price: number; ref: number | null; spend: number; n: number }[];
}

export interface MarketRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  ref: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number;
  value: number;
  week_ago: number | null;
  cap: number;
  share_count: number;
  shares_in_treasury: number;
  bid: number | null;
  ask: number | null;
  halted_until: string | null;
  my_qty: number;
  my_locked: number;
  spark: number[];
  revenue_7d: number;
  costs_7d: number;
  profit_7d: number;
  dividends_30d: number;
  equity: number;
  goodwill: number;
  fair_value: number;
}

export interface BookLevel {
  price: number;
  qty: number;
  orders: number;
  mine: boolean | null;
}

export interface MarketOrder {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  remaining: number;
  limit: number;
  status: "open" | "filled" | "cancelled" | "expired";
  created_at: string;
  expires_at: string | null;
  note: string | null;
  business_id?: string;
  name?: string;
}

export interface Candle {
  day: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketDetail {
  bids: BookLevel[];
  asks: BookLevel[];
  trades: { at: string; price: number; qty: number; side: "buy" | "sell" | null; mine: boolean }[];
  candles: Candle[];
  my_orders: MarketOrder[];
  holding: { qty: number; locked: number; sellable: number };
  fees: { rate: number; admin_per_share: number; min_hold: number; band: number };
}

export interface OrderResult {
  order_id: string | null;
  filled: number;
  requested: number;
  avg_price: number | null;
  status: string;
  limit: number;
  halted: boolean;
}

export type TaxKind = "fortune" | "societe" | "amende";
export type TaxStatus = "due" | "paid" | "seized" | "cancelled";

export interface TaxBill {
  id: string;
  kind: TaxKind;
  business_id: string | null;
  business_name: string | null;
  period_start: string;
  period_end: string;
  base: number;
  allowance: number;
  rate: number;
  surcharge_pct: number;
  amount: number;
  status: TaxStatus;
  due_at: string;
  paid_at: string | null;
  paid_from: string | null;
  penalty: number;
  reason: string | null;
}

export interface MyTaxes {
  surcharge_pct: number;
  faults: { at: string; expires_at: string }[];
  bills: TaxBill[];
  rates: {
    fortune: number;
    abattement: number;
    societes: number;
    penalite: number;
    majoration_par_faute: number;
    majoration_max: number;
    jours: number;
  };
}

export interface TaxesOverview {
  a_payer: { n: number; total: number };
  payes_30j: { n: number; total: number };
  saisis_30j: { n: number; total: number };
  majores: number;
  avis: { id: string; kind: TaxKind; nickname: string; business_name: string | null; amount: number; status: TaxStatus; due_at: string; surcharge_pct: number; reason: string | null }[];
}

export interface ExpenseRequest {
  id: string;
  business_id: string;
  business_name: string;
  requester_id: string;
  requester: string | null;
  item_id: string | null;
  item_name: string;
  image_url: string | null;
  seller: string | null;
  quantity: number;
  unit_price: number;
  reserved: number;
  paid: number | null;
  current_price: number | null;
  motive: string;
  related: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  note: string | null;
  treasury: number | null;
  self: boolean;
}

export type DisputeCategory = "paiement" | "livraison" | "contrat" | "degats" | "escroquerie" | "autre";
export type DisputeStatus = "open" | "settled" | "upheld" | "rejected" | "withdrawn";
export type DisputeRole = "demandeur" | "defendeur" | "juge";

export interface DisputeMessage {
  id: number;
  kind: "message" | "event";
  body: string;
  created_at: string;
  author_id: string | null;
  author: string | null;
  avatar_url: string | null;
  side: DisputeRole;
}

export interface Dispute {
  id: string;
  number: number;
  category: DisputeCategory;
  subject: string;
  claimed: number;
  fee: number;
  status: DisputeStatus;
  award: number;
  fine: number;
  fine_target: "demandeur" | "defendeur" | null;
  decision: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  last_activity_at: string;
  opened_by: string;
  plaintiff: string | null;
  plaintiff_avatar: string | null;
  defendant_id: string | null;
  defendant: string | null;
  defendant_avatar: string | null;
  business_id: string | null;
  business_name: string | null;
  role: DisputeRole;
  messages_count: number;
  messages?: DisputeMessage[];
  fines?: { amount: number; status: TaxStatus; nickname: string }[];
  fee_now?: number;
}

export const DISPUTE_CATEGORIES: Record<DisputeCategory, string> = {
  paiement: "Paiement",
  livraison: "Livraison",
  contrat: "Contrat, salaire",
  degats: "Dégâts",
  escroquerie: "Escroquerie",
  autre: "Autre",
};

export const DISPUTE_STATUS: Record<DisputeStatus, string> = {
  open: "En cours",
  settled: "Accord",
  upheld: "Fondé",
  rejected: "Rejeté",
  withdrawn: "Retiré",
};
