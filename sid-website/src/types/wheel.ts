/** Roue du jour (Lot 76, migration 0093). */

export type WheelRarity = "commun" | "rare" | "epique" | "legendaire";
export type WheelKind = "zeni" | "renommee" | "objet" | "titre" | "rien";

export type WheelPrize = {
  id: string;
  label: string;
  kind: WheelKind;
  amount: number | null;
  rarity: WheelRarity;
  item: string | null;
  title: string | null;
  min_streak: number;
  probability: number;
  available: boolean;
  reason: string | null;
};

export type WheelResult = {
  prize_id: string | null;
  label: string;
  kind: WheelKind;
  rarity: WheelRarity;
  amount: number | null;
  detail: string | null;
  probability: number | null;
  streak: number;
};

export type WheelStatus = {
  enabled: boolean;
  active: boolean;
  available: boolean;
  streak: number;
  cap: number;
  rare_now: number;
  rare_day1: number;
  prizes: WheelPrize[];
  tomorrow: WheelPrize[];
  all: WheelPrize[];
  at_cap: WheelPrize[];
  today: WheelResult | null;
  history: { day: string; label: string; kind: WheelKind; rarity: WheelRarity; amount: number | null; streak: number }[];
  next_reset: string;
};

export const RARITY: Record<WheelRarity, { label: string; fill: string; alt: string; text: string; ring: string }> = {
  commun: { label: "Commun", fill: "#34415f", alt: "#2a3550", text: "#e6ecf8", ring: "rgba(230,236,248,0.35)" },
  rare: { label: "Rare", fill: "#4f7fb8", alt: "#4673aa", text: "#f4f8ff", ring: "#8fb3d9" },
  epique: { label: "Épique", fill: "#8a5cd0", alt: "#7d50c2", text: "#fbf6ff", ring: "#c39bff" },
  legendaire: { label: "Légendaire", fill: "#e8c547", alt: "#ddb93a", text: "#2b2100", ring: "#ffe27a" },
};

export const KIND_LABEL: Record<WheelKind, string> = {
  zeni: "Zénis",
  renommee: "Renommée",
  objet: "Objet de la boutique",
  titre: "Titre",
  rien: "Rien",
};

export function prizeText(p: { kind: WheelKind; label: string; amount: number | null; detail?: string | null; item?: string | null; title?: string | null }) {
  if (p.kind === "zeni") return `${Number(p.amount ?? 0).toLocaleString("fr-FR")} z`;
  if (p.kind === "renommee") return `+${Number(p.amount ?? 0).toLocaleString("fr-FR")} renommée`;
  if (p.kind === "objet") return p.item ?? p.detail ?? p.label;
  if (p.kind === "titre") return `Titre : ${p.title ?? p.label}`;
  return p.label;
}

/** Texte d'une part de la roue : le montant réel pour les zénis et la renommée. */
export function segmentText(p: { kind: WheelKind; label: string; amount: number | null }) {
  if (p.kind === "zeni") return `${Number(p.amount ?? 0).toLocaleString("fr-FR")} z`;
  if (p.kind === "renommee") return `+${Number(p.amount ?? 0).toLocaleString("fr-FR")} renommée`;
  return p.label;
}

export const pct = (p: number | null | undefined, digits = 1) =>
  `${(Number(p ?? 0) * 100).toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
