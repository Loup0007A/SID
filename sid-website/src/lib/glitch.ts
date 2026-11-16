/**
 * Lieu inconnu, sur les trois sites (Lot 81) : les membres qui ont brouillé
 * leur position depuis L'Envers de la Cartographie. Leur pseudo et leur
 * avatar « buguent » partout où ils s'affichent (src/brand/glitch.ts).
 *
 * Deux listes : celle que le serveur a utilisée pour la page (gardée telle
 * quelle pour l'hydratation) et la plus récente, relue par GlitchSync.
 * Fichier identique dans les trois sites.
 */

export type GlitchedMember = { nickname: string; avatar_url?: string | null };

type Snapshot = { names: Set<string>; avatars: Set<string> };

/** État lu par la couche JSX : union des deux listes. */
export const GLITCH: { on: boolean; re: RegExp | null; avatars: Set<string> } = { on: false, re: null, avatars: new Set() };

const EMPTY: Snapshot = { names: new Set(), avatars: new Set() };
let initial: Snapshot = EMPTY;
let current: Snapshot = EMPTY;
let initialKey = "";
let currentKey = "";
let fetched = false;
const listeners = new Set<() => void>();

/** Adresse d'avatar sans paramètres (?t=… ajouté au changement d'image). */
export const avatarKey = (src: string | null | undefined) => (src ? src.split("?")[0] : "");

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function snapshot(list: unknown): [Snapshot, string] {
  const rows = (Array.isArray(list) ? list : []) as GlitchedMember[];
  const names = new Set<string>();
  const avatars = new Set<string>();
  for (const r of rows) {
    const n = typeof r?.nickname === "string" ? r.nickname.trim() : "";
    if (n.length >= 2) names.add(n);
    const a = avatarKey(r?.avatar_url);
    if (a) avatars.add(a);
  }
  const key = [...names].sort().join("\n") + "\n#" + [...avatars].sort().join("\n");
  return [{ names, avatars }, key];
}

function rebuild() {
  const names = new Set([...initial.names, ...current.names]);
  GLITCH.avatars = new Set([...initial.avatars, ...current.avatars]);
  // Pseudo entier : ni lettre, ni chiffre, ni _ juste avant ou juste après.
  GLITCH.re = names.size
    ? new RegExp(
        `(^|[^\\p{L}\\p{N}_])(${[...names]
          .sort((a, b) => b.length - a.length)
          .map(esc)
          .join("|")})(?![\\p{L}\\p{N}_])`,
        "gu",
      )
    : null;
  GLITCH.on = names.size > 0 || GLITCH.avatars.size > 0;
}

/**
 * Liste donnée par le serveur (rendu serveur, puis BrandProvider dans le
 * navigateur). Ne prévient personne : elle est posée pendant le rendu.
 */
export function primeGlitched(list: unknown) {
  const [snap, key] = snapshot(list);
  if (key === initialKey && (fetched || key === currentKey)) return;
  initial = snap;
  initialKey = key;
  if (!fetched) {
    current = snap;
    currentKey = key;
  }
  rebuild();
}

/** Liste relue dans le navigateur (GlitchSync). */
export function updateGlitched(list: unknown) {
  fetched = true;
  const [snap, key] = snapshot(list);
  if (key === currentKey) return;
  current = snap;
  currentKey = key;
  rebuild();
  listeners.forEach((fn) => fn());
}

export function subscribeGlitch(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Brouillé maintenant (liste la plus récente). */
export const isGlitchedNow = (name: string) => current.names.has(name);
/** Brouillé au rendu serveur de la page (pour l'hydratation). */
export const wasGlitchedAtLoad = (name: string) => initial.names.has(name);
