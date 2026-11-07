/** Formats partagés de l'économie (Lot 69). */

const nf = (min: number, max: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max });
const n0 = nf(0, 0);
const n2 = nf(0, 2);
const p2 = nf(2, 2);
const p4 = nf(2, 4);
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/** Montant en zénis : 1 234,5 z. */
export const z = (n: number | null | undefined, digits: 0 | 2 = 2) => `${(digits === 0 ? n0 : n2).format(Number(n ?? 0))} z`;
/** Montant compact : 1,2 k z. */
export const zk = (n: number | null | undefined) => `${compact.format(Number(n ?? 0))} z`;
/** Cours d'une action : toujours 2 décimales (4 sous 1 z). */
export const px = (n: number | null | undefined) => (n == null ? "—" : (Math.abs(n) < 1 ? p4 : p2).format(Number(n)));
/** Pourcentage depuis une fraction (0,012 → « 1,2 % »). */
export function pct(x: number | null | undefined, digits = 1, sign = false) {
  if (x == null || !Number.isFinite(x)) return "—";
  const v = x * 100;
  const s = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v));
  return `${sign ? (v > 0 ? "+" : v < 0 ? "−" : "") : v < 0 ? "−" : ""}${s} %`;
}
/** Variation relative entre deux valeurs. */
export const change = (now: number | null | undefined, ref: number | null | undefined) =>
  now == null || ref == null || ref === 0 ? null : now / ref - 1;

export const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
export const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Échéance lisible : « dans 3 j », « demain », « dépassée ». */
export function dueIn(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "échéance dépassée";
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return `dans ${Math.max(h, 1)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "demain" : `dans ${d} j`;
}

/** Classe de couleur d'une variation : bleu à la hausse, rouge à la baisse. */
export const tone = (x: number | null | undefined) => (x == null || Math.abs(x) < 1e-9 ? "text-paper/60" : x > 0 ? "text-blue-light" : "text-red");
export const arrow = (x: number | null | undefined) => (x == null || Math.abs(x) < 1e-9 ? "■" : x > 0 ? "▲" : "▼");
