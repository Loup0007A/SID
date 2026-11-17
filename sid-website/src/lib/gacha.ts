/**
 * Recrutement de renforts (Lot 85). Les calculs suivent ceux de la base
 * (_gacha_odds, _gacha_cost, migration 0102) : ils servent à l'affichage,
 * le tirage lui-même se fait côté serveur.
 */

export const GACHA_RANKS = ["E", "D", "C", "B", "A", "S", "Divin"] as const;
export type GachaRank = (typeof GACHA_RANKS)[number];

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

/** Bonus au-delà duquel le rang Divin est déjà assuré. */
export function luckMax(probDivin: number): number {
  return Math.ceil(1 / probDivin);
}

/**
 * Chaque rang de D à Divin vaut sa chance × luck, des plus rares aux plus
 * courants, tant qu'il reste des chances ; puis le rang E, et le reste
 * donne un tirage raté.
 */
export function gachaOdds(probE: number, probDivin: number, luck = 1): GachaOdds {
  const k = Math.max(1, Math.min(luck, luckMax(probDivin)));
  const r = Math.pow(probDivin / probE, 1 / 6);
  const out = {} as GachaOdds;
  let left = 1;
  for (let i = 6; i >= 1; i--) {
    const q = Math.min(probE * Math.pow(r, i) * k, left);
    out[GACHA_RANKS[i]] = q;
    left -= q;
  }
  out.E = Math.min(probE, left);
  out.fail = Math.max(0, left - out.E);
  return out;
}

export function gachaCost(price: number, luck = 1, probDivin = 0.000001): number {
  const k = Math.max(1, Math.min(luck, luckMax(probDivin)));
  return Math.round(price * Math.pow(k, COST_EXPONENT) * 100) / 100;
}

/** « 1 / 18 », « 1 / 1 000 000 », « 44 % ». */
export function formatOdds(p: number): string {
  if (p <= 0) return "—";
  if (p >= 0.9995) return "100 %";
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
