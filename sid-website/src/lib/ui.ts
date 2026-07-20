// Classes Tailwind partagées, pour garder un style cohérent (et modifiable
// en un seul endroit) sur tout le site : coins arrondis, transitions douces.

export const inputClass =
  "w-full rounded-lg border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20";

export const labelClass = "font-mono text-xs uppercase tracking-wide text-paper-text/80";

const buttonBase =
  "rounded-lg px-4 py-2 font-display text-sm uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40";

export const buttonPrimary = `${buttonBase} bg-red text-ink hover:bg-red-light`;
export const buttonSecondary = `${buttonBase} bg-blue text-ink hover:bg-blue-light`;
export const buttonOutline = `${buttonBase} border border-paper/30 text-paper hover:bg-paper hover:text-ink`;
export const buttonGhostRed = `${buttonBase} border border-red/70 text-red hover:bg-red hover:text-ink`;
export const buttonGhostBlue = `${buttonBase} border border-blue/70 text-blue hover:bg-blue hover:text-ink`;
