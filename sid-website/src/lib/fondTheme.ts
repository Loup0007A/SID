/**
 * Thème du fond (Lot 90) : le S.I.D. par défaut, ou l'évent affiché.
 * Couleurs et motifs : src/app/fonds.css, généré par scripts/fonds.mjs.
 * Si plusieurs évents sont affichés, le premier de cette liste l'emporte.
 */
import type { EventKey } from "@/lib/events";

/** election_force : l'élection, quand l'élu a pris le pouvoir par la force (Lot 91). */
export type FondTheme = "sid" | EventKey | "election_force";

export const THEME_ORDER: EventKey[] = [
  "election",
  "grande_chasse",
  "noel",
  "halloween",
  "saint_valentin",
  "poisson_avril",
  "paques",
  "premier_mai",
  "fete_musique",
  "quatorze_juillet",
  "armistice",
];

export function themeFromDecor(decor: Partial<Record<string, unknown>> | null | undefined): FondTheme {
  if (!decor) return "sid";
  return THEME_ORDER.find((k) => decor[k] === true) ?? "sid";
}
