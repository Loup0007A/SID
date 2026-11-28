/** Calendrier de l'avent (Lot 103, migration 0134). */

export type AventAvantage = "bouclier" | "roue_double" | "renommee_bonus";

export type AventRecompense = {
  id: string;
  rang_min: number;
  rang_max: number;
  zenis: number;
  renommee: number;
  avantage: AventAvantage | null;
  avantage_valeur: number | null;
  avantage_heures: number | null;
};

export type AventCase = {
  jour: number;
  jeu: string | null;
  nom: string | null;
  consigne: string | null;
  ouvre_le: string;
  ouverte: boolean;
  mon_score: number | null;
  bonus: boolean;
  meilleur: number | null;
  mes_points: number | null;
  essais_restants: number;
};

export type AventEtat = {
  edition: number;
  actif: boolean;
  debut: string;
  fin: string;
  clos: boolean;
  aujourdhui: string;
  essais_par_jour: number;
  bonus_jour: number;
  distribue: boolean;
  cases: AventCase[];
  mon_rang: number | null;
  mes_points: number;
  classes: number;
  bac_a_sable: boolean;
  recompenses: AventRecompense[];
  mon_gain: {
    rang: number;
    points: number;
    zenis: number;
    renommee: number;
    avantage: AventAvantage | null;
    avantage_valeur: number | null;
    avantage_jusqu: string | null;
  } | null;
};

export type AventLigne = {
  rang: number;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  points: number;
  cases: number;
  recompense: AventRecompense | null;
};

export const AVANTAGES: Record<AventAvantage, { nom: string; detail: string }> = {
  bouclier: { nom: "Bouclier anti-farces", detail: "arrête les farces en cours et en protège" },
  roue_double: { nom: "Roue doublée", detail: "les gains en zénis de la roue du jour sont doublés" },
  renommee_bonus: { nom: "Renommée majorée", detail: "chaque gain de renommée reçoit un supplément" },
};

export const z = (n: number) => `${Math.round(Number(n)).toLocaleString("fr-FR")} z`;

export function duree(h: number) {
  if (h % 24 === 0) {
    const j = h / 24;
    return `${j} jour${j > 1 ? "s" : ""}`;
  }
  return `${h} h`;
}

export function rangs(r: { rang_min: number; rang_max: number }) {
  const s = (n: number) => (n === 1 ? "1er" : `${n}e`);
  return r.rang_min === r.rang_max ? s(r.rang_min) : `${s(r.rang_min)} à ${s(r.rang_max)}`;
}

/** « 1 000 z, +50 renommée, roue doublée 2 jours » */
export function recompenseTexte(r: AventRecompense | null) {
  if (!r) return "";
  const p: string[] = [];
  if (Number(r.zenis) > 0) p.push(z(r.zenis));
  if (r.renommee > 0) p.push(`+${r.renommee} renommée`);
  if (r.avantage) {
    const nom = r.avantage === "renommee_bonus" ? `renommée +${r.avantage_valeur} %` : AVANTAGES[r.avantage].nom.toLowerCase();
    p.push(`${nom} ${duree(r.avantage_heures ?? 0)}`);
  }
  return p.join(", ");
}

export function jourCourt(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
