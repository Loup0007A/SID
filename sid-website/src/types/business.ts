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
