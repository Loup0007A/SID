/**
 * Les événements du S.I.D. : même clé que le réglage d'affichage en base
 * (site_decor / set_site_decor, Modération → Affichage événementiel) et que
 * la colonne `event` des titres.
 */
export type EventKey =
  | "halloween"
  | "noel"
  | "saint_valentin"
  | "poisson_avril"
  | "paques"
  | "premier_mai"
  | "fete_musique"
  | "quatorze_juillet"
  | "armistice"
  | "grande_chasse";

export type EventInfo = {
  key: EventKey;
  name: string;
  emoji: string;
  /** Période automatique, en clair. */
  period: string;
  /** Couleur du libellé « affiché en ce moment » (Modération). */
  color: string;
  /** Ce qui s'affiche, pour la Modération. */
  description: string;
};

export const EVENT_LIST: EventInfo[] = [
  {
    key: "saint_valentin",
    name: "Saint-Valentin",
    emoji: "💘",
    period: "du 10 au 14 février",
    color: "#ff7aa8",
    description:
      "Dossier : nuit rose, cœurs qui montent, pont des amoureux, guirlande de cœurs, Cupidon qui passe, lettre d'amour du pied de page. Carte et wiki : guirlande de cœurs, Cupidon, cœurs sur les vagues.",
  },
  {
    key: "poisson_avril",
    name: "Poisson d'avril",
    emoji: "🐟",
    period: "le 1er avril",
    color: "#7fd8ff",
    description:
      "Dossier : poissons en papier qui nagent, algues, guirlande de poissons, un poisson collé sur le « S.I.D. », blagues du pied de page. Carte et wiki : poissons en papier, sceau-poisson.",
  },
  {
    key: "paques",
    name: "Pâques",
    emoji: "🥚",
    period: "du Vendredi saint au lundi de Pâques",
    color: "#ffd86b",
    description:
      "Dossier : aube de printemps, cloches qui reviennent de Rome, prairie fleurie et œufs, guirlande d'œufs, œuf qui éclot au pied de page. Carte et wiki : cloches, œufs sur les vagues.",
  },
  {
    key: "premier_mai",
    name: "1er mai",
    emoji: "🌿",
    period: "le 1er mai",
    color: "#b7f5c9",
    description:
      "Dossier : muguet, pétales blancs, guirlande de clochettes, pigeon porte-bonheur, brin de muguet au pied de page. Carte et wiki : guirlande de muguet, brins sur les vagues.",
  },
  {
    key: "fete_musique",
    name: "Fête de la musique",
    emoji: "🎵",
    period: "le 21 juin",
    color: "#c9a6ff",
    description:
      "Dossier : projecteurs, notes qui s'envolent, foule et égaliseur, guirlande de notes, guitare au pied de page. Carte et wiki : notes, guirlande, projecteurs.",
  },
  {
    key: "quatorze_juillet",
    name: "14 juillet",
    emoji: "🎆",
    period: "les 13 et 14 juillet",
    color: "#7fb2ff",
    description:
      "Dossier : feux d'artifice, Paris et la tour Eiffel, fanions bleu-blanc-rouge, Patrouille de France, fusée au pied de page. Carte et wiki : fanions, Patrouille de France, feux d'artifice.",
  },
  {
    key: "armistice",
    name: "11 novembre",
    emoji: "🕊️",
    period: "le 11 novembre",
    color: "#9db7e8",
    description:
      "Sobre : bleuets, brume du matin, colombe, bleuet du souvenir au pied de page (un court texte). Carte et wiki : bleuets et colombe.",
  },
  {
    key: "grande_chasse",
    name: "La Grande Chasse",
    emoji: "🏹",
    period: "du 9 au 15 mars",
    color: "#ffb35c",
    description:
      "Semaine des chasseurs : crépuscule sur la vallée, campement et feu de camp, Brasombre (la wyverne des cendres) perchée au loin puis qui survole la page avec son ombre, fanions de chasse, cor au pied de page, tableau de chasse sur l'accueil. Carte et wiki : fanions, survol, braises, « proie du jour » sur le wiki.",
  },
  {
    key: "halloween",
    name: "Halloween",
    emoji: "🎃",
    period: "du 15 octobre au 2 novembre",
    color: "#ff9a3c",
    description:
      "Dossier : lune, cimetière, chauves-souris, toile d'araignée, citrouille du pied de page. Carte : toile, chauves-souris, sceau en citrouille, bords teintés. Wiki : lune, citrouilles sur les vagues, mer orangée.",
  },
  {
    key: "noel",
    name: "Noël",
    emoji: "🎄",
    period: "du 1er décembre au 6 janvier",
    color: "#9fe3cf",
    description:
      "Dossier : neige, aurore, étoile, collines et chalet, guirlande sous la barre du haut, traîneau, cadeau du pied de page. Carte : guirlande, givre sur les bords, sceau en sapin, traîneau. Wiki : neige, étoile, mer givrée, cadeaux sur les vagues.",
  },
];

/** Dans l'ordre de l'année (pour la Modération). */
export const EVENT_ORDER: EventKey[] = [
  "saint_valentin",
  "grande_chasse",
  "poisson_avril",
  "paques",
  "premier_mai",
  "fete_musique",
  "quatorze_juillet",
  "halloween",
  "armistice",
  "noel",
];

export const EVENTS = Object.fromEntries(EVENT_LIST.map((e) => [e.key, e])) as Record<EventKey, EventInfo>;
