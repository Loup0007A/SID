/**
 * Options des farces (Lot 36) : réglages choisis par le lanceur dans le
 * panneau de son pouvoir, contrôlés côté base par _troll_params
 * (migration 0062), puis lus par les effets chez la cible.
 */

import type { TrollPower } from "@/lib/titles";

/* ---------------------------------------------------------------
   Catalogues
   --------------------------------------------------------------- */

export const HAUNT_CREATURES = {
  fantome: { emoji: "👻", label: "Fantôme" },
  crane: { emoji: "💀", label: "Crâne" },
  citrouille: { emoji: "🎃", label: "Citrouille" },
  chauvesouris: { emoji: "🦇", label: "Chauve-souris" },
  ovni: { emoji: "🛸", label: "Ovni" },
} as const;
export type HauntCreature = keyof typeof HAUNT_CREATURES;

export const PARTY_THEMES = {
  anniversaire: {
    label: "Non-anniversaire",
    emoji: "🎂",
    floaters: ["🎈", "🎁"],
    colors: ["#ffe08a", "#ff6b8a", "#62d8ff", "#9dffbf", "#d2a0ff"],
    banner: (who: string) => `Joyeux non-anniversaire, ${who} !`,
  },
  carnaval: {
    label: "Carnaval",
    emoji: "🎭",
    floaters: ["🎭", "🪅"],
    colors: ["#ff3d7f", "#ffd23f", "#3bceac", "#7b2cbf", "#ff8c42"],
    banner: (who: string) => `C'est carnaval chez ${who} !`,
  },
  nouvelan: {
    label: "Nouvel an",
    emoji: "🎆",
    floaters: ["🥂", "🎆"],
    colors: ["#f5d06f", "#ffffff", "#c9a227", "#9ad0ff", "#f5d06f"],
    banner: (who: string) => `Bonne année ${who} ! (avec un peu d'avance)`,
  },
  disco: {
    label: "Disco",
    emoji: "🪩",
    floaters: ["🪩", "🕺"],
    colors: ["#ff00c8", "#00e5ff", "#fffb00", "#8a2be2", "#ff00c8"],
    banner: (who: string) => `Disco inferno chez ${who} !`,
  },
} as const;
export type PartyTheme = keyof typeof PARTY_THEMES;
export const PARTY_CURSORS = ["🎉", "🥳", "🎈", "🍰", "🎊", "🦄"] as const;

export const ABYSS_SPEEDS = {
  lent: { label: "Lente", px: 1, ms: 120 },
  moyen: { label: "Moyenne", px: 1, ms: 60 },
  rapide: { label: "Rapide", px: 2, ms: 40 },
} as const;
export type AbyssSpeed = keyof typeof ABYSS_SPEEDS;

export const BAILIFF_WORDS = ["SAISI", "CONFISQUÉ", "VENDU", "SOUS SCELLÉS"] as const;
export const BAILIFF_TONES = {
  officiel: { label: "Officiel", title: "Avis de saisie", button: "Je proteste… mais j'obtempère" },
  menacant: { label: "Menaçant", title: "Dernier avertissement", button: "D'accord, d'accord…" },
  ridicule: { label: "Ridicule", title: "Avis de saisie (très sérieux)", button: "Rendez-moi mon doudou" },
} as const;
export type BailiffTone = keyof typeof BAILIFF_TONES;
export const BAILIFF_DEFAULT_ITEMS = "dossier, zénis, objets, quêtes, dignité";

export const FLATTERY_COLORS = [
  { hex: "#B23B2E", label: "Rouge" },
  { hex: "#E8C547", label: "Or" },
  { hex: "#D6579A", label: "Rose" },
  { hex: "#3F8F5F", label: "Vert" },
] as const;
export const FLATTERY_DEFAULT = "est le meilleur !";

export const MIRROR_MODES = {
  horizontal: { label: "Miroir", hint: "gauche et droite inversées, et la tête en bas de temps en temps" },
  vertical: { label: "Tête en bas", hint: "le site à l'envers, et en miroir de temps en temps" },
  rotation: { label: "Penché", hint: "tout penche un peu, puis fait un demi-tour de temps en temps" },
  toupie: { label: "Toupie", hint: "le site tangue, puis fait un tour complet de temps en temps" },
} as const;
export type MirrorMode = keyof typeof MIRROR_MODES;

/* Réécriture : quatre lexiques. */
type Lexicon = { label: string; emoji: string; sid: string; words: [string, string][] };

export const REWRITE_THEMES: Record<"potager" | "pirate" | "bebe" | "medieval", Lexicon> = {
  potager: {
    label: "Potager",
    emoji: "🥔",
    sid: "S.O.S.",
    words: [
      ["quêtes", "patates"], ["quête", "patate"], ["zénis", "cailloux"], ["zéni", "caillou"],
      ["missions", "siestes"], ["mission", "sieste"], ["membres", "pingouins"], ["membre", "pingouin"],
      ["dossiers", "doudous"], ["dossier", "doudou"], ["boutique", "brocante"], ["banque", "tirelire"],
      ["classement", "concours de grimaces"], ["puissance", "mollesse"], ["messagerie", "pigeonnier"],
      ["messages", "pigeons"], ["message", "pigeon"], ["carte", "nappe"], ["entreprises", "stands de limonade"],
      ["entreprise", "stand de limonade"], ["simulations", "siestes éveillées"], ["simulation", "sieste éveillée"],
      ["notifications", "ragots"], ["notification", "ragot"], ["accueil", "vestibule"], ["profil", "portrait"],
      ["titres", "sobriquets"], ["titre", "sobriquet"], ["administration", "grande chambellerie"], ["admin", "grand chambellan"],
      ["argent", "monnaie de singe"], ["solde", "tas de cailloux"], ["recrutement", "casting"],
      ["organigramme", "arbre généalogique"], ["trombinoscope", "album de famille"], ["intelligence", "jugeote"],
      ["technique", "bricolage"], ["réglages", "caprices"], ["données", "secrets"], ["envoyer", "chuchoter"],
      ["valider", "bénir"], ["acheter", "troquer"], ["enregistrer", "graver"], ["déconnexion", "évasion"],
    ],
  },
  pirate: {
    label: "Pirate",
    emoji: "🏴‍☠️",
    sid: "Kraken",
    words: [
      ["quêtes", "chasses au trésor"], ["quête", "chasse au trésor"], ["zénis", "doublons"], ["zéni", "doublon"],
      ["missions", "abordages"], ["mission", "abordage"], ["membres", "matelots"], ["membre", "matelot"],
      ["dossiers", "journaux de bord"], ["dossier", "journal de bord"], ["boutique", "taverne"], ["banque", "coffre au trésor"],
      ["classement", "tableau des primes"], ["puissance", "rhum"], ["messagerie", "longue-vue"],
      ["messages", "bouteilles à la mer"], ["message", "bouteille à la mer"], ["carte", "carte au trésor"],
      ["entreprises", "navires"], ["entreprise", "navire"], ["simulations", "tempêtes"], ["simulation", "tempête"],
      ["notifications", "cris de vigie"], ["notification", "cri de vigie"], ["accueil", "pont principal"],
      ["profil", "avis de recherche"], ["titres", "grades"], ["titre", "grade"], ["administration", "capitainerie"],
      ["admin", "capitaine"], ["argent", "butin"], ["solde", "butin"], ["recrutement", "enrôlement"],
      ["organigramme", "équipage"], ["trombinoscope", "galerie des pendus"], ["valider", "hisser"],
      ["envoyer", "jeter à la mer"], ["acheter", "piller"], ["enregistrer", "graver sur le mât"], ["déconnexion", "planche"],
    ],
  },
  bebe: {
    label: "Bébé",
    emoji: "🍼",
    sid: "Doudou Club",
    words: [
      ["quêtes", "bêtises"], ["quête", "bêtise"], ["zénis", "bonbons"], ["zéni", "bonbon"],
      ["missions", "câlins"], ["mission", "câlin"], ["membres", "bébés"], ["membre", "bébé"],
      ["dossiers", "bavoirs"], ["dossier", "bavoir"], ["boutique", "coffre à jouets"], ["banque", "tirelire cochon"],
      ["classement", "concours de bisous"], ["puissance", "dodo"], ["messagerie", "babillage"],
      ["messages", "gazouillis"], ["message", "gazouilli"], ["carte", "tapis d'éveil"],
      ["entreprises", "bacs à sable"], ["entreprise", "bac à sable"], ["simulations", "comptines"], ["simulation", "comptine"],
      ["notifications", "pleurnicheries"], ["notification", "pleurnicherie"], ["accueil", "parc"], ["profil", "photo de bébé"],
      ["titres", "petits noms"], ["titre", "petit nom"], ["administration", "les grands"], ["admin", "maman"],
      ["argent", "sucettes"], ["solde", "tas de bonbons"], ["recrutement", "crèche"], ["organigramme", "arbre à doudous"],
      ["valider", "faire un bisou"], ["envoyer", "gazouiller"], ["acheter", "réclamer"], ["enregistrer", "ranger"],
      ["déconnexion", "sieste"],
    ],
  },
  medieval: {
    label: "Médiéval",
    emoji: "🏰",
    sid: "Royaume",
    words: [
      ["quêtes", "croisades"], ["quête", "croisade"], ["zénis", "écus"], ["zéni", "écu"],
      ["missions", "joutes"], ["mission", "joute"], ["membres", "chevaliers"], ["membre", "chevalier"],
      ["dossiers", "parchemins"], ["dossier", "parchemin"], ["boutique", "échoppe"], ["banque", "trésor royal"],
      ["classement", "tournoi"], ["puissance", "bravoure"], ["messagerie", "colombier"],
      ["messages", "missives"], ["message", "missive"], ["carte", "mappemonde"],
      ["entreprises", "guildes"], ["entreprise", "guilde"], ["simulations", "épreuves"], ["simulation", "épreuve"],
      ["notifications", "proclamations"], ["notification", "proclamation"], ["accueil", "grand-salle"], ["profil", "blason"],
      ["titres", "fiefs"], ["titre", "fief"], ["administration", "cour du roi"], ["admin", "roi"],
      ["argent", "or"], ["solde", "bourse"], ["recrutement", "adoubement"], ["organigramme", "lignée"],
      ["valider", "sceller"], ["envoyer", "dépêcher"], ["acheter", "marchander"], ["enregistrer", "consigner"],
      ["déconnexion", "retraite au monastère"],
    ],
  },
};
export type RewriteTheme = keyof typeof REWRITE_THEMES;

export const DRAGON_SKINS = {
  demon: { label: "Démon", emoji: "😈", hint: "ailes de chauve-souris, cornes" },
  noir: { label: "Dragon noir", emoji: "🐉", hint: "le grand dragon d'écailles sombres" },
  drake: { label: "Drake", emoji: "🦎", hint: "plus fin et rapide d'allure" },
} as const;
export type DragonSkin = keyof typeof DRAGON_SKINS;
export const DRAGON_FINALES = {
  carboniser: { label: "Carbonisation", emoji: "🔥", hint: "le dernier joueur part en cendres" },
  devorer: { label: "Dévoration", emoji: "🦷", hint: "le dragon fond sur lui et l'avale" },
} as const;
export type DragonFinale = keyof typeof DRAGON_FINALES;

/** Prix des options de l'arène (zénis) et joueurs en plus ; l'admin peut les
 *  changer (app_config : arena_price_player, arena_price_tribune,
 *  arena_price_finale, arena_max_extra), troll_status renvoie les valeurs. */
export type ArenaPrices = { maxExtra: number; extraPlayer: number; spectators: number; finale: number };
export const ARENA_PRICES: ArenaPrices = { maxExtra: 5, extraPlayer: 1_000_000, spectators: 5_000_000, finale: 5_000_000 };

export function arenaPricesFrom(a: { max_extra?: number; price_player?: number; price_tribune?: number; price_finale?: number } | null | undefined): ArenaPrices {
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Number(v) : d);
  return {
    maxExtra: n(a?.max_extra, ARENA_PRICES.maxExtra),
    extraPlayer: n(a?.price_player, ARENA_PRICES.extraPlayer),
    spectators: n(a?.price_tribune, ARENA_PRICES.spectators),
    finale: n(a?.price_finale, ARENA_PRICES.finale),
  };
}

/* ---------------------------------------------------------------
   Options par pouvoir, avec leurs valeurs par défaut
   --------------------------------------------------------------- */

export type TrollOptions = {
  calcul: { count: number; level: number; reset: boolean };
  hantise: { creature: HauntCreature; chance: number; catches: number; message: string };
  fete: { theme: PartyTheme; message: string; density: number; cursor: string };
  abysses: { speed: AbyssSpeed; invert: boolean; creatures: boolean; darkness: number };
  huissier: { word: string; items: string; tone: BailiffTone; every: number };
  flatterie: { phrase: string; color: string; every: number };
  miroir: { mode: MirrorMode; every: number };
  reecriture: { theme: RewriteTheme; custom: [string, string][] };
  rationnement: { interval: number; keys: boolean };
  avenant: { clauses: string[]; dodges: number; signature: boolean };
  reseau: { map: Record<string, string>; logic: string; every: number };
  defi_dragon: { skin: DragonSkin; spectators: boolean; finale: DragonFinale | null; players: string[] };
};

/** Bornes qui dépendent du niveau du titre (comme en base). */
export const hauntMaxChance = (level: number) => Math.min(75, 35 + 10 * (Math.max(level, 1) - 1));
export const hauntMaxCatches = (level: number) => 3 + Math.max(level, 1);

export function defaultOptions<P extends TrollPower>(power: P, level = 1): TrollOptions[P] {
  const all: TrollOptions = {
    calcul: { count: 3, level: 50, reset: true },
    hantise: { creature: "fantome", chance: hauntMaxChance(level), catches: hauntMaxCatches(level), message: "" },
    fete: { theme: "anniversaire", message: "", density: 2, cursor: "🎉" },
    abysses: { speed: "moyen", invert: true, creatures: true, darkness: 2 },
    huissier: { word: "SAISI", items: "", tone: "officiel", every: 3 },
    flatterie: { phrase: FLATTERY_DEFAULT, color: "#B23B2E", every: 1 },
    miroir: { mode: "horizontal", every: 70 },
    reecriture: { theme: "potager", custom: [] },
    rationnement: { interval: 8, keys: false },
    avenant: { clauses: [], dodges: 3, signature: false },
    reseau: { map: {}, logic: "rotation", every: 30 },
    defi_dragon: { skin: "demon", spectators: false, finale: null, players: [] },
  };
  return all[power];
}

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

/** Lit les options d'une farce en cours (valeurs absentes = défaut). */
export function readOptions<P extends TrollPower>(power: P, params: Record<string, unknown> | null | undefined, level = 1): TrollOptions[P] {
  const p = params ?? {};
  const d = defaultOptions(power, level) as Record<string, unknown>;
  let o: unknown;
  switch (power) {
    case "calcul":
      o = { count: num(p.count, 3, 1, 5), level: num(p.level, 50, 20, 80), reset: bool(p.reset, true) };
      break;
    case "hantise":
      o = {
        creature: pick(p.creature, Object.keys(HAUNT_CREATURES) as HauntCreature[], "fantome"),
        chance: num(p.chance, hauntMaxChance(level), 10, 100),
        catches: num(p.catches, hauntMaxCatches(level), 1, 20),
        message: txt(p.message, 80),
      };
      break;
    case "fete":
      o = { theme: pick(p.theme, Object.keys(PARTY_THEMES) as PartyTheme[], "anniversaire"), message: txt(p.message, 80), density: num(p.density, 2, 1, 3), cursor: pick(p.cursor, PARTY_CURSORS, "🎉") };
      break;
    case "abysses":
      o = { speed: pick(p.speed, Object.keys(ABYSS_SPEEDS) as AbyssSpeed[], "moyen"), invert: bool(p.invert, true), creatures: bool(p.creatures, true), darkness: num(p.darkness, 2, 1, 3) };
      break;
    case "huissier":
      o = { word: pick(p.word, BAILIFF_WORDS, "SAISI"), items: txt(p.items, 160), tone: pick(p.tone, Object.keys(BAILIFF_TONES) as BailiffTone[], "officiel"), every: num(p.every, 3, 1, 6) };
      break;
    case "flatterie":
      o = { phrase: txt(p.phrase, 60) || FLATTERY_DEFAULT, color: pick(p.color, FLATTERY_COLORS.map((c) => c.hex), "#B23B2E"), every: num(p.every, 1, 1, 3) };
      break;
    case "miroir":
      o = { mode: pick(p.mode, Object.keys(MIRROR_MODES) as MirrorMode[], "horizontal"), every: num(p.every, 70, 20, 180) };
      break;
    case "reecriture":
      o = {
        theme: pick(p.theme, Object.keys(REWRITE_THEMES) as RewriteTheme[], "potager"),
        custom: Array.isArray(p.custom)
          ? (p.custom as unknown[])
              .filter((x): x is [string, string] => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string")
              .map(([a, b]) => [a.trim().slice(0, 30), b.trim().slice(0, 30)] as [string, string])
              .filter(([a, b]) => a && b)
              .slice(0, 6)
          : [],
      };
      break;
    case "rationnement":
      o = { interval: num(p.interval, 8, 3, 15), keys: bool(p.keys, false) };
      break;
    case "avenant":
      o = {
        clauses: Array.isArray(p.clauses) ? (p.clauses as unknown[]).map((c) => txt(c, 140)).filter(Boolean).slice(0, 3) : [],
        dodges: num(p.dodges, 3, 0, 5),
        signature: bool(p.signature, false),
      };
      break;
    case "defi_dragon":
      o = {
        skin: pick(p.skin, Object.keys(DRAGON_SKINS) as DragonSkin[], "demon"),
        spectators: bool(p.spectators, false),
        finale: p.finale === "carboniser" || p.finale === "devorer" ? p.finale : null,
        players: Array.isArray(p.players) ? (p.players as unknown[]).filter((x): x is string => typeof x === "string") : [],
      };
      break;
    default:
      o = { ...d, ...p };
  }
  return o as TrollOptions[P];
}

/** Coût des options de l'arène. */
export function arenaCost(o: TrollOptions["defi_dragon"], prices: ArenaPrices = ARENA_PRICES): number {
  return Math.min(o.players.length, prices.maxExtra) * prices.extraPlayer + (o.spectators ? prices.spectators : 0) + (o.finale ? prices.finale : 0);
}

/** Phrase de la flatterie, prête à afficher. */
export function flatteryLine(by: string, phrase: string) {
  return `… et ${by} ${phrase}`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Construit la fonction de réécriture d'un thème, avec les mots perso en premier. */
export function makeRewriter(theme: RewriteTheme, custom: [string, string][] = []) {
  const lex = REWRITE_THEMES[theme] ?? REWRITE_THEMES.potager;
  const pairs: [string, string][] = [...custom, ...lex.words];
  const map = new Map(pairs.map(([a, b]) => [a.toLowerCase(), b] as [string, string]));
  // Les plus longs d'abord, pour que « quêtes » passe avant « quête ».
  const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(^|[^\\p{L}])(${keys.map(escapeRe).join("|")})(?=[^\\p{L}]|$)`, "giu");
  return (text: string) =>
    text.replace(/S\.I\.D\.?/g, lex.sid).replace(re, (_m, pre: string, w: string) => {
      const rep = map.get(w.toLowerCase()) ?? w;
      const out = w === w.toUpperCase() && w.length > 1 ? rep.toUpperCase() : w[0] === w[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
      return pre + out;
    });
}
