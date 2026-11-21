/**
 * Affichage et confort (Réglages, Lots 93-95). Fichier identique sur le
 * Dossier Central, la Cartographie et le Wiki. Gardés sur le compte
 * (profiles.display_prefs, migrations 0116 et 0118 du Dossier Central) et
 * recopiés dans chaque navigateur (mémoire locale + cookie « sid-confort »),
 * pour être posés sur <html> dès le premier affichage (script COMFORT_BOOT
 * du layout) ; ComfortSync relit le compte.
 *  - theme : clair (le site tel quel), sombre, ou selon l'appareil ;
 *  - epure : fond uni, ni motif ni particules, ni contours épais ni ombres
 *    pleines, ni décors des fêtes ; un site plus simple à regarder ;
 *  - motion : vivantes, calmes, ou selon l'appareil (réglage « réduire les
 *    animations » du système) ;
 *  - text, decor : taille du texte, décors des fêtes.
 * Sur un appareil neuf, le middleware recopie les réglages du compte dans le
 * cookie avant la première page (comfortCookie.ts) : pas de passage du clair
 * au sombre à l'ouverture.
 */

export type ThemePref = "clair" | "sombre" | "auto";
export type MotionPref = "full" | "calm" | "auto";
export type TextPref = "normal" | "large" | "xlarge";
export type ComfortPrefs = { theme: ThemePref; epure: boolean; motion: MotionPref; text: TextPref; decor: boolean };

export const COMFORT_KEY = "sid-confort-v1";
export const COMFORT_COOKIE = "sid-confort";
export const COMFORT_EVENT = "sid:comfort-changed";
export const DEFAULT_COMFORT: ComfortPrefs = { theme: "clair", epure: false, motion: "auto", text: "normal", decor: true };

/** Réglages complets à partir de valeurs partielles (compte ou navigateur). */
export function normalizeComfort(p: Partial<ComfortPrefs> | null | undefined): ComfortPrefs {
  const v = p ?? {};
  return {
    theme: v.theme === "sombre" || v.theme === "auto" ? v.theme : "clair",
    epure: v.epure === true,
    motion: v.motion === "calm" || v.motion === "full" ? v.motion : "auto",
    text: v.text === "large" || v.text === "xlarge" ? v.text : "normal",
    decor: v.decor !== false,
  };
}

export const sameComfort = (a: ComfortPrefs, b: ComfortPrefs) => JSON.stringify(normalizeComfort(a)) === JSON.stringify(normalizeComfort(b));

function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COMFORT_COOKIE}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function readComfort(): ComfortPrefs {
  try {
    const raw = localStorage.getItem(COMFORT_KEY) ?? readCookie();
    return raw ? normalizeComfort(JSON.parse(raw) as Partial<ComfortPrefs>) : DEFAULT_COMFORT;
  } catch {
    return DEFAULT_COMFORT;
  }
}

const media = (q: string) => (typeof window !== "undefined" && window.matchMedia?.(q).matches) || false;

export function isDark(p: ComfortPrefs) {
  return p.theme === "sombre" || (p.theme === "auto" && media("(prefers-color-scheme: dark)"));
}

export function isCalm(p: ComfortPrefs) {
  return p.motion === "calm" || (p.motion === "auto" && media("(prefers-reduced-motion: reduce)"));
}

/** Décors des fêtes affichés (coupés en mode épuré). */
export const decorAllowed = (p: ComfortPrefs) => p.decor && !p.epure;

export function applyComfort(p: ComfortPrefs) {
  const c = document.documentElement.classList;
  c.toggle("sombre", isDark(p));
  c.toggle("epure", p.epure);
  c.toggle("calme", isCalm(p));
  c.toggle("texte-grand", p.text === "large");
  c.toggle("texte-tres-grand", p.text === "xlarge");
  c.toggle("sans-decor", !decorAllowed(p));
}

/** Cookie lu par le script du <head> quand la mémoire locale est vide. */
export function writeComfortCookie(p: ComfortPrefs) {
  try {
    document.cookie = `${COMFORT_COOKIE}=${encodeURIComponent(JSON.stringify(normalizeComfort(p)))}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies bloqués */
  }
}

export function writeComfort(p: ComfortPrefs) {
  try {
    localStorage.setItem(COMFORT_KEY, JSON.stringify(p));
  } catch {
    /* navigation privée : le réglage vaut pour cette page */
  }
  writeComfortCookie(p);
  applyComfort(p);
  window.dispatchEvent(new CustomEvent(COMFORT_EVENT, { detail: p }));
}

/** Script du <head> : mêmes règles qu'applyComfort, avant le premier affichage. */
export const COMFORT_BOOT = `try{var s=null;try{s=localStorage.getItem("${COMFORT_KEY}")}catch(e){}if(!s){var k=document.cookie.match(/(?:^|; )${COMFORT_COOKIE}=([^;]*)/);if(k)s=decodeURIComponent(k[1])}var p=JSON.parse(s||"{}"),c=document.documentElement.classList,m=function(q){return!!(window.matchMedia&&matchMedia(q).matches)};if(p.theme==="sombre"||(p.theme==="auto"&&m("(prefers-color-scheme: dark)")))c.add("sombre");if(p.epure===true)c.add("epure");if(p.motion==="calm"||(p.motion!=="full"&&m("(prefers-reduced-motion: reduce)")))c.add("calme");if(p.text==="large")c.add("texte-grand");if(p.text==="xlarge")c.add("texte-tres-grand");if(p.decor===false||p.epure===true)c.add("sans-decor")}catch(e){}`;
