/**
 * Les trois simulations externes qui font progresser les facteurs de
 * puissance. C'est ICI qu'on branche un site quand il est prêt :
 *
 *   url            adresse du site à afficher dans l'iframe
 *                  (null = pas encore branché : le bouton « Lancer » reste grisé)
 *   inDevelopment  true = bandeau « En développement » sur la tuile et la page
 *
 * Les deux sont indépendants : on peut renseigner l'url pour tester le
 * branchement tout en gardant le bandeau, puis retirer le bandeau une fois
 * la simulation ouverte à tous.
 *
 * Le fonctionnement de l'API utilisée par ces sites est décrit dans
 * API_SIMULATIONS.md, à la racine du projet.
 */

export type SimulationKind = "donjons" | "intelligence" | "techniques";

/** Les trois facteurs, tels qu'ils sont nommés en base (table member_stats). */
export type StatKey = "intelligence" | "strength" | "technique";

export const STAT_LABELS: Record<StatKey, string> = {
  intelligence: "Intelligence",
  strength: "Puissance",
  technique: "Technique",
};

export interface SimulationSite {
  kind: SimulationKind;
  /** Nom de la tuile et de la page. */
  label: string;
  /** Facteur que la simulation fait progresser. */
  factor: StatKey;
  description: string;
  emoji: string;
  /** Dépôt GitHub du site. */
  repo: string;
  url: string | null;
  inDevelopment: boolean;
}

export const SIMULATION_SITES: Record<SimulationKind, SimulationSite> = {
  donjons: {
    kind: "donjons",
    label: "Donjons",
    factor: "strength",
    description: "Explore les donjons pour gagner en puissance.",
    emoji: "🏰",
    repo: "Loup0007A/3D-game-world",
    url: null,
    inDevelopment: true,
  },
  intelligence: {
    kind: "intelligence",
    label: "Intelligence",
    factor: "intelligence",
    description: "Prépare des potions pour gagner en intelligence.",
    emoji: "🧪",
    repo: "Loup0007A/Potions",
    url: null,
    inDevelopment: true,
  },
  techniques: {
    kind: "techniques",
    label: "Techniques",
    factor: "technique",
    description: "Maîtrise de nouvelles techniques.",
    emoji: "🥋",
    repo: "Loup0007A/Techniques",
    url: null,
    inDevelopment: true,
  },
};

export const SIMULATION_KINDS = Object.keys(SIMULATION_SITES) as SimulationKind[];

export function isSimulationKind(value: unknown): value is SimulationKind {
  return typeof value === "string" && (SIMULATION_KINDS as string[]).includes(value);
}

/** Origine (protocole + domaine) d'un site branché, ou null. */
export function siteOrigin(site: SimulationSite): string | null {
  if (!site.url) return null;
  try {
    return new URL(site.url).origin;
  } catch {
    return null;
  }
}

/** Type du message que le site envoie au S.I.D. (window.parent.postMessage). */
export const RESULT_MESSAGE_TYPE = "sid:simulation-result";
