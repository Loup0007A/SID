/**
 * Présence en ligne (Lot 37) : ce que fait chaque membre en ce moment.
 *
 * Le site envoie un signal (presence_ping) avec la page en cours ; la base
 * retire les identifiants et ne garde que le dernier signal, effacé au bout
 * d'un jour. La phrase affichée (« À la banque », « En plein donjon »…) est
 * calculée ici, chez celui qui regarde.
 */

import { entryForPath } from "@/lib/navigation";
import { SIMULATION_SITES, type SimulationKind } from "@/lib/simulationSites";

/** Activité particulière d'une page : une partie ouverte, l'arène du dragon. */
export type PresenceExtra = "jeu" | "arene_dragon" | "arene_joueur" | "arene_tribune";

export const PRESENCE_ACTIVITY_EVENT = "sid:activity";

/** Une page annonce une activité particulière (null pour l'effacer). */
export function announceActivity(extra: PresenceExtra | null) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PRESENCE_ACTIVITY_EVENT, { detail: extra }));
}

export interface OnlineMember {
  id: string;
  nickname: string;
  avatar_url: string | null;
  /** Page en cours (identifiants remplacés par :id) ; null si l'activité est masquée. */
  page: string | null;
  extra: PresenceExtra | null;
  idle: boolean;
  since: string;
  /** Le membre a masqué son activité (l'administration la voit quand même). */
  masked: boolean;
  /** N'apparaît pas aux autres membres (compte invisible ou présence masquée). */
  hidden: boolean;
  me: boolean;
}

const PLAYING: Record<SimulationKind, string> = {
  donjons: "En plein donjon",
  intelligence: "Prépare des potions",
  techniques: "S'entraîne aux techniques",
};

const PHRASES: Record<string, string> = {
  profile: "Sur son dossier",
  chat: "Dans la messagerie",
  notifications: "Lit ses notifications",
  titles: "Regarde les titres",
  settings: "Dans les réglages",
  privacy: "Dans « Mes données »",
  quests: "Parcourt les quêtes",
  tech: "Dans l'arbre technologique",
  map: "Sur la carte",
  leaderboard: "Consulte le classement",
  "org-chart": "Regarde l'organigramme",
  members: "Au trombinoscope",
  shop: "À la boutique",
  bank: "À la banque",
  business: "Gère ses entreprises",
};

/** Ce qu'on affiche pour l'activité d'un membre. */
export function activityOf(m: Pick<OnlineMember, "page" | "extra" | "masked">): { emoji: string; text: string; muted?: boolean } {
  if (m.page == null) return { emoji: "🔒", text: "Activité masquée", muted: true };
  if (m.extra === "arene_dragon") return { emoji: "🐉", text: "Dragon dans l'arène" };
  if (m.extra === "arene_joueur") return { emoji: "⚔️", text: "Combat un dragon" };
  if (m.extra === "arene_tribune") return { emoji: "🎥", text: "En tribune de l'arène" };

  const page = m.page;
  if (page === "/dashboard") return { emoji: "🏠", text: "Sur l'accueil" };
  if (page.startsWith("/dashboard/profile/")) return { emoji: "🪪", text: "Consulte un dossier" };
  if (page === "/dashboard/admin") return { emoji: "🛡️", text: "Dans l'administration" };

  const sim = page.match(/^\/dashboard\/simulations\/([a-z]+)/);
  if (sim && sim[1] in SIMULATION_SITES) {
    const kind = sim[1] as SimulationKind;
    const site = SIMULATION_SITES[kind];
    return m.extra === "jeu" ? { emoji: site.emoji, text: PLAYING[kind] } : { emoji: site.emoji, text: `Prépare une partie (${site.label})` };
  }

  const entry = entryForPath(page);
  if (!entry) return { emoji: "🧭", text: "Quelque part sur le site" };
  if (entry.group === "admin") return { emoji: entry.emoji, text: `Administration · ${entry.label}` };
  return { emoji: entry.emoji, text: PHRASES[entry.key] ?? entry.label };
}

/** « depuis 12 min », « depuis 1 h 05 ». */
export function sinceLabel(iso: string, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `depuis ${min} min`;
  return `depuis ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
