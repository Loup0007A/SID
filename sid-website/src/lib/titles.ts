/**
 * Les douze titres secrets et leurs pouvoirs de farce.
 *
 * Les règles (conditions, durées, recharges) sont appliquées en base
 * (migration 0061) ; ce fichier ne sert qu'à l'affichage : noms, couleurs,
 * énigmes montrées tant que le titre n'est pas obtenu, et description des
 * pouvoirs.
 */

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
  | "juriste";

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
  | "avenant";

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
}

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
    how: "Niveau 101 de Donjons.",
    power: "defi_dragon",
  },
  {
    id: "architecte",
    name: "Architecte du Réseau",
    emoji: "🕸️",
    colors: ["#62d8ff", "#2b5cff"],
    maxLevel: 1,
    riddle: "Cent potions, cent énigmes, cent problèmes… et une porte de plus.",
    how: "Niveau 101 de l'Intelligence.",
    power: "reseau",
  },
  {
    id: "foudre",
    name: "Éclair Vivant",
    emoji: "⚡",
    colors: ["#ffe95c", "#ff8a00"],
    maxLevel: 1,
    riddle: "Le cent-unième circuit ne pardonne pas la moindre hésitation.",
    how: "Niveau 101 des Techniques.",
    power: "calcul",
  },
  {
    id: "fantome",
    name: "Fantôme 404",
    emoji: "👻",
    colors: ["#ff4df4", "#36e6ff"],
    maxLevel: 5,
    riddle: "Certaines pages n'existent pas. Très rarement, quelque chose y vit.",
    how: "Le glitch d'une page introuvable, vaincu. Chaque nouvelle victoire le renforce.",
    power: "hantise",
  },
  {
    id: "mecene",
    name: "Grand Mécène",
    emoji: "🎁",
    colors: ["#ffe08a", "#c98a1e"],
    maxLevel: 5,
    riddle: "Les cadeaux d'anniversaire les plus fous finissent toujours par revenir.",
    how: "Un cadeau d'anniversaire princier… et la récompense trouvée. Chaque nouvel anniversaire le renforce.",
    power: "fete",
  },
  {
    id: "abyssal",
    name: "Abyssal",
    emoji: "🌊",
    colors: ["#2ee6d0", "#0b2a6e"],
    maxLevel: 1,
    riddle: "Tout en bas de la page, il y a encore plus bas. Le fond choisit qui il garde.",
    how: "Cent mille lignes de descente, et l'abysse t'a choisi.",
    power: "abysses",
  },
  {
    id: "magnat",
    name: "Magnat Insatiable",
    emoji: "💰",
    colors: ["#9dffbf", "#d9a92b"],
    maxLevel: 1,
    riddle: "Un milliard qui s'envole, vingt paquets qui arrivent, et le soleil ne s'est couché qu'une fois.",
    how: "Un milliard de zénis dépensé et vingt objets achetés le même jour.",
    power: "huissier",
  },
  {
    id: "flatteur",
    name: "Lèche-Bottes Boursier",
    emoji: "💋",
    colors: ["#ff6b8a", "#b23b2e"],
    maxLevel: 1,
    riddle: "Dis-le en rouge et en gras à qui commande. Puis cours à la bourse avant que l'heure ne tourne.",
    how: "« tu es le meilleur ! » en rouge et en gras à un admin, puis cent actions achetées dans l'heure.",
    power: "flatterie",
  },
  {
    id: "arpenteur",
    name: "Arpenteur des Mondes",
    emoji: "🧭",
    colors: ["#a6d8ff", "#6a4dff"],
    maxLevel: 1,
    riddle: "Un million de kilomètres. Pas un de moins.",
    how: "Un million de kilomètres parcourus sur la carte.",
    power: "miroir",
  },
  {
    id: "scribe",
    name: "Scribe Infini",
    emoji: "🪶",
    colors: ["#f6e6b8", "#9c6b2f"],
    maxLevel: 1,
    riddle: "Mille lignes d'encre sur une seule page de savoir.",
    how: "Une fiche du Wiki de plus de mille lignes.",
    power: "reecriture",
  },
  {
    id: "metronome",
    name: "Métronome",
    emoji: "🎵",
    colors: ["#d2a0ff", "#5b2fc9"],
    maxLevel: 1,
    riddle: "Un mot par jour, pas un de plus, pas un de moins. Pendant toute une lune.",
    how: "Exactement un message par jour pendant trente jours.",
    power: "rationnement",
  },
  {
    id: "juriste",
    name: "Lecteur des Petites Lignes",
    emoji: "📜",
    colors: ["#e4e0d6", "#8a6a44"],
    maxLevel: 1,
    riddle: "Ceux qui lisent vraiment les conditions savent sur quoi insister ensuite.",
    how: "Les CGU et la politique de confidentialité lues, puis cent clics sur « S.I.D. ».",
    power: "avenant",
  },
];

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
