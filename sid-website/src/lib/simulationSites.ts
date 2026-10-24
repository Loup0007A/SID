import type { IconName } from "@/components/icons/sidIcons";
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
 *
 *   epreuves       identifiants (« slugs ») des épreuves que le site envoie
 *                  dans ses résultats (champ `epreuve`) : un résultat n'est
 *                  accepté que pour la simulation dont il relève.
 */

export type SimulationKind = "donjons" | "intelligence" | "techniques";

/**
 * Compétences = épreuves des sites (slugs envoyés dans `epreuve`). Chacune a
 * ses points (0 à 100, +1 par réussite). Facteurs :
 *   Intelligence = moyenne de Potions, Énigmes et Problème
 *   Puissance    = Donjons
 *   Technique    = Techniques
 */
export type SkillKey = "potions" | "enigmes" | "probleme" | "techniques" | "mondes-vivants";

export const SKILLS: { key: SkillKey; label: string; kind: SimulationKind }[] = [
  { key: "potions", label: "Potions", kind: "intelligence" },
  { key: "enigmes", label: "Énigmes", kind: "intelligence" },
  { key: "probleme", label: "Problème", kind: "intelligence" },
  { key: "techniques", label: "Techniques", kind: "techniques" },
  { key: "mondes-vivants", label: "Donjons", kind: "donjons" },
];

export const SKILL_LABELS = Object.fromEntries(SKILLS.map((s) => [s.key, s.label])) as Record<SkillKey, string>;

export function isSkillKey(value: unknown): value is SkillKey {
  return typeof value === "string" && SKILLS.some((s) => s.key === value);
}

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
  icon: IconName;
  /** Dépôt GitHub du site. */
  repo: string;
  url: string | null;
  inDevelopment: boolean;
  epreuves: string[];
}

export const SIMULATION_SITES: Record<SimulationKind, SimulationSite> = {
  donjons: {
    kind: "donjons",
    label: "Donjons",
    factor: "strength",
    description: "100 niveaux : une île, ses reliques, son gardien et son portail. Chaque niveau terminé rapporte +1 Puissance (Puissance N = niveau N+1 ouvert).",
    emoji: "🏰",
    icon: "castle",
    repo: "Loup0007A/3D-game-world",
    url: "https://loup0007a.github.io/3D-game-world/",
    inDevelopment: false,
    epreuves: ["mondes-vivants"],
  },
  intelligence: {
    kind: "intelligence",
    label: "Intelligence",
    factor: "intelligence",
    description: "Prépare des potions pour gagner en intelligence.",
    emoji: "🧪",
    icon: "brain",
    repo: "Loup0007A/Potions",
    url: "https://intelligence-seven-henna.vercel.app/",
    inDevelopment: false,
    epreuves: ["potions", "enigmes", "probleme"],
  },
  techniques: {
    kind: "techniques",
    label: "Techniques",
    factor: "technique",
    description: "Maîtrise de nouvelles techniques.",
    emoji: "🥋",
    icon: "gi",
    repo: "Loup0007A/Techniques",
    url: "https://techniques-delta.vercel.app/",
    inDevelopment: false,
    epreuves: ["techniques"],
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

/**
 * Format de résultat déjà utilisé par Potions, Techniques et 3D-game-world :
 * message `sid-quest-resultat` envoyé au parent, et requête GET vers /api,
 * avec les champs epreuve, statut ("reussi", "echoue", "invalide"…),
 * reussi (1 ou 0) et debut (date de début de la tentative).
 */
export const SITE_RESULT_MESSAGE_TYPE = "sid-quest-resultat";

/** Une tentative commencée plus de 10 min avant la partie S.I.D. ne lui appartient pas. */
const STALE_ATTEMPT_MS = 10 * 60 * 1000;

export type SiteReportVerdict =
  | { action: "record"; success: boolean }
  | { action: "ignore"; reason: string };

/**
 * Lit un résultat au format des sites et dit s'il faut l'enregistrer.
 * `runStartedAt` : début de la partie S.I.D. (ms), pour écarter une
 * vieille tentative renvoyée par le site au rechargement de la page.
 */
export function interpretSiteReport(
  site: SimulationSite,
  report: { epreuve?: unknown; statut?: unknown; reussi?: unknown; debut?: unknown },
  runStartedAt: number | null
): SiteReportVerdict {
  const epreuve = typeof report.epreuve === "string" ? report.epreuve : "";
  if (!site.epreuves.includes(epreuve)) {
    return { action: "ignore", reason: `épreuve « ${epreuve || "?"} » sans rapport avec ${site.label}` };
  }

  const statut = typeof report.statut === "string" ? report.statut : "";
  // « invalide » = tentative annulée (page quittée ou rechargée) : ni gagnée
  // ni perdue, la partie reste ouverte.
  if (statut === "invalide") return { action: "ignore", reason: "tentative annulée" };

  const reussi = report.reussi === 1 || report.reussi === "1" || report.reussi === true;
  const success = statut === "reussi" || reussi;

  // Seuls les ÉCHECS d'une vieille tentative sont écartés (un site peut
  // signaler au rechargement une tentative laissée en plan). Une réussite
  // compte toujours : elle n'est envoyée qu'au moment où elle a lieu, même
  // si la tentative avait commencé longtemps avant (partie reprise).
  if (!success && runStartedAt !== null && report.debut !== undefined && report.debut !== null && report.debut !== "") {
    const debut = typeof report.debut === "number" ? report.debut : Date.parse(String(report.debut));
    if (Number.isFinite(debut) && debut < runStartedAt - STALE_ATTEMPT_MS) {
      return { action: "ignore", reason: "tentative commencée avant la partie" };
    }
  }

  return { action: "record", success };
}

/** La simulation à laquelle appartient une épreuve envoyée par un site. */
export function siteForEpreuve(epreuve: unknown): SimulationSite | null {
  if (typeof epreuve !== "string") return null;
  return Object.values(SIMULATION_SITES).find((s) => s.epreuves.includes(epreuve)) ?? null;
}
