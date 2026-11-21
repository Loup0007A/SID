/**
 * Pouvoirs des alliés dans les simulations (Lot 89).
 *
 * Chaque allié a une spécialité, tirée de son nom (toujours la même pour un
 * même nom) ; un allié Divin en a deux. Sa force va de 1 à 10 : rang, éveil
 * et place de ses facteurs dans la fourchette du rang. Les valeurs calculées
 * ici partent dans l'adresse du jeu (paramètre sid_allie) : le jeu les
 * applique telles quelles, à chaque niveau, 101 compris.
 */
import { GACHA_RANKS, type GachaRank } from "@/lib/gacha";

export type AllyKind = "donjons" | "intelligence" | "techniques";

export const ALLY_SPECS = {
  intelligence: ["clairvoyant", "sablier", "mentor", "erudit"],
  techniques: ["horloger", "gabarit", "contremaitre", "second"],
  donjons: ["lame", "bouclier", "soigneur", "eclaireur"],
} as const;
export type AllySpec = (typeof ALLY_SPECS)[AllyKind][number];

export const SPEC_LABEL: Record<AllySpec, string> = {
  clairvoyant: "Clairvoyant",
  sablier: "Gardien du sablier",
  mentor: "Mentor",
  erudit: "Érudit",
  horloger: "Horloger",
  gabarit: "Gabarit",
  contremaitre: "Contremaître",
  second: "Second d'atelier",
  lame: "Lame",
  bouclier: "Bouclier",
  soigneur: "Soigneur",
  eclaireur: "Éclaireur",
};

// Fourchette des facteurs par rang (la même que _gacha_bounds en base).
const BOUNDS: Record<GachaRank, [number, number]> = {
  E: [3, 12], D: [10, 22], C: [20, 38], B: [35, 55], A: [52, 75], S: [72, 95], Divin: [120, 200],
};

type CardLike = { rank: GachaRank; name: string; level?: number | null; power?: number | null; base_power?: number | null };

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Force de 1 à 10. */
export function allyForce(card: CardLike): number {
  const idx = Math.max(0, GACHA_RANKS.indexOf(card.rank));
  const level = Math.max(0, Math.min(5, Number(card.level ?? 0)));
  const [lo, hi] = BOUNDS[card.rank] ?? BOUNDS.E;
  const base = Number(card.base_power ?? (Number(card.power ?? lo) / (1 + 0.05 * level)));
  const place = Math.max(0, Math.min(1, (base - lo) / (hi - lo)));
  return Math.round(Math.min(10, 1 + idx + 0.5 * level + 0.5 * place) * 10) / 10;
}

export function allySpecs(kind: AllyKind, card: CardLike): AllySpec[] {
  const list = ALLY_SPECS[kind];
  const h = fnv(card.name.normalize("NFC").toLowerCase());
  const first = h % list.length;
  if (card.rank !== "Divin") return [list[first]];
  const second = (first + 1 + ((h >>> 8) % (list.length - 1))) % list.length;
  return [list[first], list[second]];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Valeurs de chaque spécialité selon la force. */
export function specValues(spec: AllySpec, f: number): Record<string, number | boolean> {
  switch (spec) {
    case "clairvoyant": return { indices: 1 + Math.floor(f / 2.5) };
    case "sablier": return { minutes: Math.round(3 * f), secondes: Math.round(2.5 * f) };
    case "mentor": return { pardons: 1 + Math.floor(f / 3.5) };
    case "erudit": return { pages: Math.min(1, r2(0.25 * f)), brouillard: f >= 6, chiffres: f >= 4 };
    case "horloger": return { temps: r2(1 + 0.05 * f), minutes: Math.round(2 * f) };
    case "gabarit": return { taille: r2(1 + 0.05 * f), allege: r2(0.035 * f) };
    case "contremaitre": return { pardons: 1 + Math.floor(f / 3.5), seuil: Math.round(80 - 3 * f) };
    case "second": return { ateliers: 1 + Math.floor(f / 4) };
    case "lame": return { cadence: r1(Math.max(0.6, 2.1 - 0.14 * f)), degats: 1 + Math.floor(f / 3), attaque: r2(0.03 * f) };
    case "bouclier": return { gardes: 1 + Math.floor(f / 2.5), recharge: Math.round(75 - 4.5 * f), reduction: r2(0.03 * f) };
    case "soigneur": return { soin: r1(0.3 * f), releve: Math.round(60 - 4.5 * f), relances: Math.floor(f / 4) };
    case "eclaireur": return { vitesse: r2(0.03 * f), flair: Math.round(40 - 2.5 * f), butin: r2(0.03 * f), buffs: r2(0.05 * f) };
  }
}

const pct = (x: number | boolean) => `${Math.round(Number(x) * 100)} %`;
const fois = (n: number | boolean, s: string, p = s + "s") => `${n} ${Number(n) > 1 ? p : s}`;

/** Ce que fait la spécialité, en clair. */
export function describeSpec(spec: AllySpec, v: Record<string, number | boolean>): string[] {
  switch (spec) {
    case "clairvoyant": return [
      `${fois(v.indices, "indice")} par partie, à demander quand tu veux :`,
      "Potions : une propriété cachée révélée, ou une page du carnet rendue, ou le détail du dernier mélange dans le brouillard.",
      "Énigmes : la longueur et le premier caractère de la réponse.",
      "Problème : le nombre de chiffres et le premier chiffre de la réponse.",
    ];
    case "sablier": return [
      `+${v.minutes} min sur la durée de la partie (niveau 101 compris).`,
      `Énigmes : +${v.secondes} s par énigme.`,
    ];
    case "mentor": return [
      `${fois(v.pardons, "erreur pardonnée", "erreurs pardonnées")} par partie :`,
      "Énigmes : une mauvaise réponse ou un temps dépassé fait place à une autre énigme.",
      "Potions : l'explosion du chaudron est évitée, ou 5 essais de plus quand ils sont épuisés.",
      "Problème : une tentative de plus après la dernière.",
    ];
    case "erudit": return [
      `Potions : ${Number(v.pages) >= 1 ? "toutes les pages arrachées du carnet rendues" : `${pct(v.pages)} des pages arrachées rendues`}, lexique toujours fourni${v.brouillard ? ", brouillard levé" : ""}.`,
      "Énigmes : la forme de la réponse (nombre ou mot, nombre de caractères).",
      `Problème : après une erreur, « plus grand » ou « plus petit »${v.chiffres ? ", et le nombre de chiffres de la réponse" : ""}.`,
    ];
    case "horloger": return [
      `Chaque délai des ateliers ×${String(v.temps).replace(".", ",")} : cibles, calculs, grilles, tracé ; seuils de réflexes, rythme et horloge interne élargis d'autant.`,
      `+${v.minutes} min sur la durée de la partie.`,
    ];
    case "gabarit": return [
      `Cibles, couloir et écarts de nuance ×${String(v.taille).replace(".", ",")}.`,
      `${pct(v.allege)} de répétitions en moins dans chaque atelier (cibles, calculs, grilles, battements…), texte de frappe plus court.`,
    ];
    case "contremaitre": return [
      `${fois(v.pardons, "atelier raté validé", "ateliers ratés validés")} par partie, s'il est noté au moins ${v.seuil} / 100.`,
      "Au niveau 101, c'est ce qui empêche la foudre de retomber.",
    ];
    case "second": return [
      `Fait ${fois(v.ateliers, "atelier")} du circuit à ta place (90 / 100), au choix, avant de le commencer.`,
    ];
    case "lame": return [
      `Frappe l'ennemi le plus proche toutes les ${String(v.cadence).replace(".", ",")} s (${v.degats} de dégâts).`,
      `+${pct(v.attaque)} à tes dégâts.`,
    ];
    case "bouclier": return [
      `${fois(v.gardes, "coup absorbé", "coups absorbés")} au début de chaque île, une garde rendue toutes les ${v.recharge} s.`,
      `−${pct(v.reduction)} de dégâts reçus.`,
    ];
    case "soigneur": return [
      `Rend ${String(v.soin).replace(".", ",")} vie par seconde.`,
      `Te relever prend ${v.releve} s au lieu de 60.`,
      Number(v.relances) > 0 ? `Te relève sur place ${fois(v.relances, "fois")} par île, sans mourir.` : "À partir d'une force de 4, il te relèvera aussi sur place.",
    ];
    case "eclaireur": return [
      `+${pct(v.vitesse)} de vitesse, butin plus fréquent (+${pct(v.butin)}), effets du butin ${pct(v.buffs)} plus longs.`,
      `Toutes les ${v.flair} s, une colonne de lumière sur la relique ou l'artefact le plus proche.`,
    ];
  }
}

export type AllyPowers = { kind: AllyKind; force: number; specs: { spec: AllySpec; label: string; values: Record<string, number | boolean>; lines: string[] }[] };

export function allyPowers(kind: AllyKind, card: CardLike): AllyPowers {
  const force = allyForce(card);
  return {
    kind,
    force,
    specs: allySpecs(kind, card).map((spec) => {
      const values = specValues(spec, force);
      return { spec, label: SPEC_LABEL[spec], values, lines: describeSpec(spec, values) };
    }),
  };
}

/** Valeur du paramètre sid_allie (JSON en base64url). */
export function allyParam(kind: AllyKind, card: CardLike): string {
  const p = allyPowers(kind, card);
  const json = JSON.stringify({
    k: kind, n: card.name, r: card.rank, l: Number(card.level ?? 0), f: p.force,
    s: p.specs.map((x) => x.spec), v: Object.fromEntries(p.specs.map((x) => [x.spec, x.values])),
  });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
