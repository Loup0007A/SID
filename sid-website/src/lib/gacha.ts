/**
 * Recrutement de renforts (Lot 85). Les calculs suivent ceux de la base
 * (_gacha_odds, _gacha_cost, migration 0102) : ils servent à l'affichage,
 * le tirage lui-même se fait côté serveur.
 */

export const GACHA_RANKS = ["E", "D", "C", "B", "A", "S", "Divin"] as const;
export type GachaRank = (typeof GACHA_RANKS)[number];

export const LUCK_MAX = 10;
/** 4,8 fois le prix pour une chance ×5. */
export const COST_EXPONENT = Math.log(4.8) / Math.log(5);

export type GachaSettings = { prob_e: number; prob_divin: number; price: number; luck_max: number };
export type GachaOdds = Record<GachaRank, number> & { fail: number };

export type RecruitCard = {
  id: string;
  rank: GachaRank;
  name: string;
  intelligence: number;
  strength: number;
  technique: number;
  power: number;
  kept: boolean;
};

export function gachaOdds(probE: number, probDivin: number, luck = 1): GachaOdds {
  const k = Math.max(1, Math.min(luck, LUCK_MAX));
  const r = Math.pow(probDivin / probE, 1 / 6);
  const boosted = [1, 2, 3, 4, 5, 6].map((i) => probE * Math.pow(r, i) * k);
  let sum = boosted.reduce((a, b) => a + b, 0);
  const scale = sum > 1 ? 1 / sum : 1;
  sum = Math.min(sum, 1);
  const e = Math.max(0, Math.min(probE, 1 - sum));
  const out = { E: e, fail: Math.max(0, 1 - e - sum) } as GachaOdds;
  GACHA_RANKS.slice(1).forEach((rank, i) => (out[rank] = boosted[i] * scale));
  return out;
}

export function gachaCost(price: number, luck = 1): number {
  const k = Math.max(1, Math.min(luck, LUCK_MAX));
  return Math.round(price * Math.pow(k, COST_EXPONENT) * 100) / 100;
}

/** « 1 / 18 », « 1 / 1 000 000 », « 44 % ». */
export function formatOdds(p: number): string {
  if (p <= 0) return "—";
  if (p >= 0.1) return `${(p * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  return `1 / ${Math.round(1 / p).toLocaleString("fr-FR")}`;
}

export const RANK_LABEL: Record<GachaRank, string> = {
  E: "Rang E",
  D: "Rang D",
  C: "Rang C",
  B: "Rang B",
  A: "Rang A",
  S: "Rang S",
  Divin: "Rang Divin",
};
