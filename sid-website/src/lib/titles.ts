/**
 * Les douze titres secrets et leurs pouvoirs de farce.
 *
 * Les règles (conditions, durées, recharges) sont appliquées en base
 * (migration 0061) ; ce fichier ne sert qu'à l'affichage : noms, couleurs,
 * énigmes montrées tant que le titre n'est pas obtenu, et description des
 * pouvoirs.
 */

import { commentObtenu } from "@/lib/cachet";
import type { EventKey } from "@/lib/events";

export type TitleId =
  | "dragon"
  | "architecte"
  | "foudre"
  | "fantome"
  | "mecene"
  | "abyssal"
  | "magnat"
  | "flatteur"
  | "arpenteur"
  | "scribe"
  | "metronome"
  | "juriste"
  // Titres d'événement (un par événement, à obtenir pendant l'événement).
  | "chauvesouris"
  | "lutin"
  | "cupidon"
  | "farceur"
  | "chasseur"
  | "meneur"
  | "maestro"
  | "artificier"
  | "veilleur";

export type TrollPower =
  | "defi_dragon"
  | "reseau"
  | "calcul"
  | "hantise"
  | "fete"
  | "abysses"
  | "huissier"
  | "flatterie"
  | "miroir"
  | "reecriture"
  | "rationnement"
  | "avenant"
  | "nuee"
  | "blizzard"
  | "coup_de_foudre"
  | "poisson"
  | "cloches"
  | "greve"
  | "fanfare"
  | "artifice"
  | "treve";

export interface TitleDef {
  id: TitleId;
  name: string;
  emoji: string;
  /** Deux couleurs du dégradé (clair → sombre). */
  colors: [string, string];
  maxLevel: number;
  /** Énigme affichée tant que le titre est verrouillé. */
  riddle: string;
  /** Comment il a été obtenu (montré une fois le titre débloqué). */
  how: string;
  power: TrollPower;
  /** Titre d'événement : ne s'obtient que pendant cet événement (puis se garde). */
  event?: EventKey;
}

export { EVENTS, type EventKey } from "@/lib/events";

export interface PowerDef {
  key: TrollPower;
  name: string;
  description: string;
  /** Peut viser tout le S.I.D. (à partir de ce niveau du titre). */
  everyoneFromLevel?: number;
}

export const TITLES: TitleDef[] = [
  {
    id: "dragon",
    name: "Fléau Draconique",
    emoji: "🐉",
    colors: ["#ff7a2f", "#b3121b"],
    maxLevel: 1,
    riddle: "Au-delà du centième étage, un trône attend celui qui terrasse le Primordial.",
    how: commentObtenu("dragon"),
    power: "defi_dragon",
  },
  {
    id: "architecte",
    name: "Architecte du Réseau",
    emoji: "🕸️",
    colors: ["#62d8ff", "#2b5cff"],
    maxLevel: 1,
    riddle: "Cent potions, cent énigmes, cent problèmes… et une porte de plus.",
    how: commentObtenu("architecte"),
    power: "reseau",
  },
  {
    id: "foudre",
    name: "Éclair Vivant",
    emoji: "⚡",
    colors: ["#ffe95c", "#ff8a00"],
    maxLevel: 1,
    riddle: "Le cent-unième circuit ne pardonne pas la moindre hésitation.",
    how: commentObtenu("foudre"),
    power: "calcul",
  },
  {
    id: "fantome",
    name: "Fantôme 404",
    emoji: "👻",
    colors: ["#ff4df4", "#36e6ff"],
    maxLevel: 5,
    riddle: "Certaines pages n'existent pas. Très rarement, quelque chose y vit.",
    how: commentObtenu("fantome"),
    power: "hantise",
  },
  {
    id: "mecene",
    name: "Grand Mécène",
    emoji: "🎁",
    colors: ["#ffe08a", "#c98a1e"],
    maxLevel: 5,
    riddle: "Les cadeaux d'anniversaire les plus fous finissent toujours par revenir.",
    how: commentObtenu("mecene"),
    power: "fete",
  },
  {
    id: "abyssal",
    name: "Abyssal",
    emoji: "🌊",
    colors: ["#2ee6d0", "#0b2a6e"],
    maxLevel: 1,
    riddle: "Tout en bas de la page, il y a encore plus bas. Le fond choisit qui il garde.",
    how: commentObtenu("abyssal"),
    power: "abysses",
  },
  {
    id: "magnat",
    name: "Magnat Insatiable",
    emoji: "💰",
    colors: ["#9dffbf", "#d9a92b"],
    maxLevel: 1,
    riddle: "Un milliard qui s'envole, vingt paquets qui arrivent, et le soleil ne s'est couché qu'une fois.",
    how: commentObtenu("magnat"),
    power: "huissier",
  },
  {
    id: "flatteur",
    name: "Lèche-Bottes Boursier",
    emoji: "💋",
    colors: ["#ff6b8a", "#b23b2e"],
    maxLevel: 1,
    riddle: "Dis-le en rouge et en gras à qui commande. Puis cours à la bourse avant que l'heure ne tourne.",
    how: commentObtenu("flatteur"),
    power: "flatterie",
  },
  {
    id: "arpenteur",
    name: "Arpenteur des Mondes",
    emoji: "🧭",
    colors: ["#a6d8ff", "#6a4dff"],
    maxLevel: 1,
    riddle: "Un million de kilomètres. Pas un de moins.",
    how: commentObtenu("arpenteur"),
    power: "miroir",
  },
  {
    id: "scribe",
    name: "Scribe Infini",
    emoji: "🪶",
    colors: ["#f6e6b8", "#9c6b2f"],
    maxLevel: 1,
    riddle: "Mille lignes d'encre sur une seule page de savoir.",
    how: commentObtenu("scribe"),
    power: "reecriture",
  },
  {
    id: "metronome",
    name: "Métronome",
    emoji: "🎵",
    colors: ["#d2a0ff", "#5b2fc9"],
    maxLevel: 1,
    riddle: "Un mot par jour, pas un de plus, pas un de moins. Pendant toute une lune.",
    how: commentObtenu("metronome"),
    power: "rationnement",
  },
  {
    id: "juriste",
    name: "Lecteur des Petites Lignes",
    emoji: "📜",
    colors: ["#e4e0d6", "#8a6a44"],
    maxLevel: 1,
    riddle: "Ceux qui lisent vraiment les conditions savent sur quoi insister ensuite.",
    how: commentObtenu("juriste"),
    power: "avenant",
  },
  {
    id: "chauvesouris",
    name: "Maître des Chauves-Souris",
    emoji: "🦇",
    colors: ["#ffa24a", "#5b2a86"],
    maxLevel: 1,
    riddle: "Quand les citrouilles s'allument, une aile noire passe parfois seule. Ne la laisse pas filer, encore et encore.",
    how: commentObtenu("chauvesouris"),
    power: "nuee",
    event: "halloween",
  },
  {
    id: "lutin",
    name: "Lutin Clandestin",
    emoji: "🧝",
    colors: ["#e6f3ff", "#c8202f"],
    maxLevel: 1,
    riddle: "Il ne passe qu'une fois par nuit au-dessus des archives. Certains soirs, il se laisse attraper.",
    how: commentObtenu("lutin"),
    power: "blizzard",
    event: "noel",
  },
  {
    id: "cupidon",
    name: "Cupidon Masqué",
    emoji: "💘",
    colors: ["#ff8ab4", "#b3124a"],
    maxLevel: 1,
    riddle: "Quand février rougit, un cœur ailé file au-dessus des pages. Ne le laisse pas s'envoler.",
    how: commentObtenu("cupidon"),
    power: "coup_de_foudre",
    event: "saint_valentin",
  },
  {
    id: "farceur",
    name: "Farceur d'Avril",
    emoji: "🐟",
    colors: ["#ffb08a", "#2d8fd8"],
    maxLevel: 1,
    riddle: "Le premier jour d'avril, des poissons se collent là où personne ne regarde.",
    how: commentObtenu("farceur"),
    power: "poisson",
    event: "poisson_avril",
  },
  {
    id: "chasseur",
    name: "Chasseur d'Œufs",
    emoji: "🥚",
    colors: ["#ffe08a", "#7cc98c"],
    maxLevel: 1,
    riddle: "Quand les cloches reviennent de Rome, elles sèment des œufs dans les recoins du S.I.D.",
    how: commentObtenu("chasseur"),
    power: "cloches",
    event: "paques",
  },
  {
    id: "meneur",
    name: "Meneur du 1er Mai",
    emoji: "✊",
    colors: ["#f4fff6", "#2f8a4f"],
    maxLevel: 1,
    riddle: "Le premier jour de mai, un brin porte-bonheur pousse quelque part sur le site. Cueille-le, encore.",
    how: commentObtenu("meneur"),
    power: "greve",
    event: "premier_mai",
  },
  {
    id: "maestro",
    name: "Maestro",
    emoji: "🎼",
    colors: ["#d6b8ff", "#ff7a4a"],
    maxLevel: 1,
    riddle: "Le jour le plus long, une note dorée s'échappe de la scène. Rattrape-la avant qu'elle ne s'éteigne.",
    how: commentObtenu("maestro"),
    power: "fanfare",
    event: "fete_musique",
  },
  {
    id: "artificier",
    name: "Artificier",
    emoji: "🎆",
    colors: ["#8fb3ff", "#e23a3a"],
    maxLevel: 1,
    riddle: "Le soir de la fête nationale, attrape la fusée avant qu'elle n'éclate.",
    how: commentObtenu("artificier"),
    power: "artifice",
    event: "quatorze_juillet",
  },
  {
    id: "veilleur",
    name: "Veilleur du Souvenir",
    emoji: "🕊️",
    colors: ["#c9d6f2", "#3f6fe0"],
    maxLevel: 1,
    riddle: "Le onzième jour du onzième mois, une fleur bleue invite au silence.",
    how: commentObtenu("veilleur"),
    power: "treve",
    event: "armistice",
  },
];

/** Titres secrets permanents, et titres d'événement. */
export const SECRET_TITLES = TITLES.filter((t) => !t.event);
export const EVENT_TITLES = TITLES.filter((t) => t.event);

export const POWERS: Record<TrollPower, PowerDef> = {
  defi_dragon: {
    key: "defi_dragon",
    name: "Défi du Dragon",
    description: "Tu te changes en dragon dans le jeu 3D et convoques un membre dans l'arène : il doit te combattre ou fuir. En option : jusqu'à 5 joueurs de plus, tout le S.I.D. en tribune, une cinématique de fin.",
  },
  reseau: {
    key: "reseau",
    name: "Réseau détraqué",
    description: "Tu rebranches les liens du site d'un membre sur d'autres pages, avec une logique qui change toute seule. 10 minutes.",
  },
  calcul: {
    key: "calcul",
    name: "Calcul forcé",
    description: "Ta cible doit réussir des calculs mentaux avant chaque page (3 du niveau 50 par défaut, à régler). 10 minutes.",
  },
  hantise: {
    key: "hantise",
    name: "Hantise",
    description: "Les pages de ta cible se changent en fausses erreurs 404 hantées : il faut attraper la créature pour continuer. Plus long et plus fréquent à chaque niveau.",
  },
  fete: {
    key: "fete",
    name: "Fête forcée",
    description: "Confettis à chaque clic, bannière et curseur festifs, sur le thème de ton choix. Plus long à chaque niveau ; tout le S.I.D. à partir du niveau 3.",
    everyoneFromLevel: 3,
  },
  abysses: {
    key: "abysses",
    name: "Appel des abysses",
    description: "Le défilement de ta cible s'inverse et sa page coule lentement dans les profondeurs. 10 minutes.",
  },
  huissier: {
    key: "huissier",
    name: "Huissier",
    description: "Un avis de saisie officiel, puis des tampons « SAISI » partout sur son site. Rien n'est vraiment saisi. 10 minutes.",
  },
  flatterie: {
    key: "flatterie",
    name: "Flatterie obligatoire",
    description: "Les messages de ta cible se terminent par un compliment en ton honneur (« … et <ton pseudo> est le meilleur ! », ou la phrase de ton choix). 10 minutes.",
  },
  miroir: {
    key: "miroir",
    name: "Monde à l'envers",
    description: "Le site de ta cible s'affiche en miroir, tête en bas, penché ou en toupie, et se retourne de temps en temps. 10 minutes.",
  },
  reecriture: {
    key: "reecriture",
    name: "Réécriture",
    description: "Les mots du site de ta cible changent (potager, pirate, bébé ou médiéval, plus tes propres mots) : les quêtes deviennent des patates… 10 minutes.",
  },
  rationnement: {
    key: "rationnement",
    name: "Rationnement",
    description: "Ta cible n'a droit qu'à un clic toutes les 8 secondes (de 3 à 15, clavier compris si tu veux). 10 minutes.",
  },
  avenant: {
    key: "avenant",
    name: "Avenant obligatoire",
    description: "Avant chaque page, ta cible doit lire et signer un contrat absurde dont la case s'enfuit. 10 minutes.",
  },
  nuee: {
    key: "nuee",
    name: "Nuée",
    description: "Des nuées de chauves-souris traversent l'écran de ta cible, et quelques-unes s'accrochent en haut de ses pages : il faut cliquer dessus pour les chasser. 10 minutes.",
  },
  coup_de_foudre: {
    key: "coup_de_foudre",
    name: "Coup de foudre",
    description: "Des cœurs s'envolent sur tout le site de ta cible, chacun de ses clics en fait jaillir, et ton nom passe de temps en temps dans un grand cœur. 10 minutes.",
  },
  poisson: {
    key: "poisson",
    name: "Poisson d'avril",
    description: "Des poissons en papier se collent partout sur l'écran de ta cible (il faut les décoller, ils reviennent), et de fausses nouvelles tombent : « Poisson d'avril ! ». 10 minutes.",
  },
  cloches: {
    key: "cloches",
    name: "Cloches de Pâques",
    description: "Des cloches survolent le site de ta cible et laissent tomber des œufs en chocolat qui s'entassent en bas de l'écran. Il faut les croquer pour faire de la place. 10 minutes.",
  },
  greve: {
    key: "greve",
    name: "Grève générale",
    description: "Les boutons du site de ta cible se mettent en grève les uns après les autres : impossible de cliquer dessus tant que la grève dure. Pancartes en prime. 10 minutes.",
  },
  fanfare: {
    key: "fanfare",
    name: "Fanfare",
    description: "Tout le site de ta cible danse en rythme et des notes s'envolent à chaque clic. Sans le moindre son. 10 minutes.",
  },
  artifice: {
    key: "artifice",
    name: "Feu d'artifice",
    description: "Des feux d'artifice éclatent sur l'écran de ta cible, et la Patrouille de France passe en laissant ses fumées bleu-blanc-rouge par-dessus. 10 minutes.",
  },
  treve: {
    key: "treve",
    name: "Trêve",
    description: "Le contraire d'une farce : ta cible voit des bleuets fleurir et une colombe passer, avec ton message, et pendant ce temps personne ne peut la viser d'une autre farce. 10 minutes.",
  },
  blizzard: {
    key: "blizzard",
    name: "Blizzard",
    description: "Une tempête de neige s'abat sur le site de ta cible et le givre envahit son écran : il faut frotter (souris ou doigt) pour y voir clair. 10 minutes.",
  },
};

export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t])) as Record<TitleId, TitleDef>;

export function isTitleId(value: unknown): value is TitleId {
  return typeof value === "string" && value in TITLE_BY_ID;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const roman = (n: number) => ROMAN[n] ?? String(n);

/** Nom affiché, avec le niveau pour les titres qui en ont. */
export function titleLabel(id: TitleId, level = 1): string {
  const t = TITLE_BY_ID[id];
  return t.maxLevel > 1 ? `${t.name} ${roman(level)}` : t.name;
}

export interface ActiveTroll {
  id: number;
  power: TrollPower;
  level: number;
  params: Record<string, unknown>;
  actor_id: string;
  actor: string;
  everyone: boolean;
  created_at: string;
  ends_at: string;
  /** Lot 36 : place du membre (farce ordinaire, ou arène du dragon). */
  role?: "target" | "dragon" | "player" | "spectator";
  /** Arène : joueurs convoqués. */
  players?: { id: string; name: string }[];
}

/** Demande au calque des farces de se rafraîchir (et d'ouvrir l'arène lancée). */
export const TROLLS_REFRESH_EVENT = "sid:trolls-refresh";
export function announceTrollLaunched(id?: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TROLLS_REFRESH_EVENT, { detail: { open: id ?? null } }));
}

export interface EquippedTitle {
  user_id: string;
  title_id: TitleId;
  title_name: string;
  level: number;
  dragon: boolean;
}

/** Les pages qu'on peut rebrancher avec le Réseau détraqué. */
export const NETWORK_NODES: { href: string; label: string; emoji: string }[] = [
  { href: "/dashboard", label: "Accueil", emoji: "🏠" },
  { href: "/dashboard/profile", label: "Dossier", emoji: "🪪" },
  { href: "/dashboard/chat", label: "Messagerie", emoji: "💬" },
  { href: "/dashboard/notifications", label: "Notifs", emoji: "🔔" },
  { href: "/dashboard/quests", label: "Quêtes", emoji: "📜" },
  { href: "/dashboard/map", label: "Carte", emoji: "🗺️" },
  { href: "/dashboard/leaderboard", label: "Classement", emoji: "🏆" },
  { href: "/dashboard/members", label: "Membres", emoji: "👥" },
  { href: "/dashboard/shop", label: "Boutique", emoji: "🛒" },
  { href: "/dashboard/bank", label: "Banque", emoji: "🏦" },
  { href: "/dashboard/tech", label: "Techno", emoji: "🌳" },
  { href: "/dashboard/titles", label: "Titres", emoji: "🏅" },
];

/** Événement à déclencher quand un titre vient peut-être d'être gagné. */
export const TITLES_CHANGED_EVENT = "sid:titles-changed";
export function announceTitlesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TITLES_CHANGED_EVENT));
}
