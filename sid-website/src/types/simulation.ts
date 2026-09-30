export type SimWealthClass = "pauvre" | "moyen" | "aise" | "riche";
export type SimMood = "radin" | "neutre" | "depensier" | "genereux" | "inspire";

export interface SimAgentRow {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  sex: "M" | "F";
  wealth_class: SimWealthClass;
  weekly_salary: number;
  balance: number;
  luck: number;
  ambition: number;
  can_have_children: boolean;
  mood: SimMood;
  partner_name: string | null;
  is_child_of_sim: boolean;
}

export interface PopulationStats {
  total: number;
  by_class: Partial<Record<SimWealthClass, number>>;
  avg_age: number;
  couples: number;
  total_balance: number;
  children_born: number;
  last_processed_day: string | null;
}

export interface PopulationActivityPoint {
  day: string;
  items_bought: number;
  items_amount: number;
  shares_bought: number;
  shares_amount: number;
  children: number;
}

export const WEALTH_CLASS_LABELS: Record<SimWealthClass, string> = {
  pauvre: "Pauvre",
  moyen: "Moyen",
  aise: "Aisé",
  riche: "Riche",
};

export const MOOD_LABELS: Record<SimMood, string> = {
  radin: "Radin",
  neutre: "Neutre",
  depensier: "Dépensier",
  genereux: "Généreux",
  inspire: "Inspiré",
};

export const WEALTH_CLASS_COLOR: Record<SimWealthClass, string> = {
  pauvre: "#B97575",
  moyen: "#8FB3D9",
  aise: "#6D93BC",
  riche: "#E8C547",
};
