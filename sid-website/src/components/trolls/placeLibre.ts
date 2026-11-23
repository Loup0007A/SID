/**
 * Placement des objets de farce (chauves-souris suspendues, poissons collés,
 * œufs) : jamais sur un bouton, un lien ou un champ. On tire une position,
 * on regarde ce qu'il y a dessous (en ignorant les calques de farce), et on
 * recommence si un contrôle s'y trouve. Après plusieurs essais sans place
 * libre, on renonce (null) plutôt que de cacher un bouton.
 */

const CONTROLE = "a[href], button, input, select, textarea, summary, label, [role=button], [role=tab], [role=link], [contenteditable=true]";

/** Vrai si un contrôle se trouve sous ce point de l'écran. */
export function controleSous(x: number, y: number): boolean {
  if (typeof document === "undefined") return false;
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest("[data-troll-ui]")) continue;
    return !!el.closest(CONTROLE);
  }
  return false;
}

/** Vrai si une zone (en pixels) ne recouvre aucun contrôle. */
export function zoneLibre(left: number, top: number, width: number, height: number): boolean {
  const pts: [number, number][] = [
    [0.5, 0.5],
    [0.1, 0.15],
    [0.9, 0.15],
    [0.1, 0.85],
    [0.9, 0.85],
    [0.5, 0.15],
    [0.5, 0.85],
  ];
  return pts.every(([fx, fy]) => !controleSous(left + width * fx, top + height * fy));
}

/**
 * Tire une position avec `tirer` jusqu'à trouver une zone libre.
 * `zone` traduit la position en rectangle à l'écran (pixels).
 */
export function placeLibre<T>(tirer: () => T, zone: (p: T) => [number, number, number, number], essais = 14): T | null {
  for (let i = 0; i < essais; i++) {
    const p = tirer();
    if (zoneLibre(...zone(p))) return p;
  }
  return null;
}

/** Contrôles que la grève ne doit jamais viser : navigation, fenêtres, envois. */
export const GREVE_EPARGNE = "nav, header, [role=dialog], [role=alertdialog], [aria-modal=true], [type=submit], form button:not([type=button])";
