/**
 * Affichage et confort (Réglages, Lot 93) : propres à chaque navigateur.
 * Posés sur <html> dès le premier affichage (script de layout.tsx), puis à
 * chaque changement.
 *  - theme : clair (le site tel quel), sombre, ou selon l'appareil ;
 *  - epure : fond uni, ni motif ni particules, ni contours épais ni ombres
 *    pleines, ni décors des fêtes ; un site plus simple à regarder ;
 *  - motion, text, decor : animations, taille du texte, décors des fêtes.
 */

export type ThemePref = "clair" | "sombre" | "auto";
export type MotionPref = "full" | "calm";
export type TextPref = "normal" | "large" | "xlarge";
export type ComfortPrefs = { theme: ThemePref; epure: boolean; motion: MotionPref; text: TextPref; decor: boolean };

export const COMFORT_KEY = "sid-confort-v1";
export const COMFORT_EVENT = "sid:comfort-changed";
export const DEFAULT_COMFORT: ComfortPrefs = { theme: "clair", epure: false, motion: "full", text: "normal", decor: true };

export function readComfort(): ComfortPrefs {
  try {
    const raw = localStorage.getItem(COMFORT_KEY);
    if (!raw) return DEFAULT_COMFORT;
    const p = JSON.parse(raw) as Partial<ComfortPrefs>;
    return {
      theme: p.theme === "sombre" || p.theme === "auto" ? p.theme : "clair",
      epure: p.epure === true,
      motion: p.motion === "calm" ? "calm" : "full",
      text: p.text === "large" || p.text === "xlarge" ? p.text : "normal",
      decor: p.decor !== false,
    };
  } catch {
    return DEFAULT_COMFORT;
  }
}

export function isDark(p: ComfortPrefs) {
  if (p.theme === "sombre") return true;
  if (p.theme !== "auto" || typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Décors des fêtes affichés (coupés en mode épuré). */
export const decorAllowed = (p: ComfortPrefs) => p.decor && !p.epure;

export function applyComfort(p: ComfortPrefs) {
  const c = document.documentElement.classList;
  c.toggle("sombre", isDark(p));
  c.toggle("epure", p.epure);
  c.toggle("calme", p.motion === "calm");
  c.toggle("texte-grand", p.text === "large");
  c.toggle("texte-tres-grand", p.text === "xlarge");
  c.toggle("sans-decor", !decorAllowed(p));
}

export function writeComfort(p: ComfortPrefs) {
  try {
    localStorage.setItem(COMFORT_KEY, JSON.stringify(p));
  } catch {
    /* navigation privée : le réglage vaut pour cette page */
  }
  applyComfort(p);
  window.dispatchEvent(new CustomEvent(COMFORT_EVENT, { detail: p }));
}

/** Script du <head> : mêmes règles qu'applyComfort, avant le premier affichage. */
export const COMFORT_BOOT = `try{var p=JSON.parse(localStorage.getItem("${COMFORT_KEY}")||"{}"),c=document.documentElement.classList,d=p.theme==="sombre"||(p.theme==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)c.add("sombre");if(p.epure===true)c.add("epure");if(p.motion==="calm")c.add("calme");if(p.text==="large")c.add("texte-grand");if(p.text==="xlarge")c.add("texte-tres-grand");if(p.decor===false||p.epure===true)c.add("sans-decor")}catch(e){}`;
