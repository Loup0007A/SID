/**
 * Calculs mentaux, repris de l'atelier « Calcul éclair » de la simulation
 * Techniques. d = difficulté entre 0 et 1 ; le niveau L correspond à
 * d = (L - 1) / 99 (niveau 50 ≈ 0,495), avec (15 - 9 d) secondes par calcul.
 */

const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

type Gen = { min: number; f: (d: number) => [string, number] };

const TYPES: Gen[] = [
  { min: 0, f: (d) => { const a = R(12, 40 + Math.round(900 * d)), b = R(12, 40 + Math.round(900 * d)); return [`${a} + ${b}`, a + b]; } },
  { min: 0, f: (d) => { const a = R(40, 80 + Math.round(900 * d)), b = R(11, a - 5); return [`${a} − ${b}`, a - b]; } },
  { min: 0, f: (d) => { const a = R(3, 9), b = R(12, 19 + Math.round(80 * d)); return [`${a} × ${b}`, a * b]; } },
  { min: 0.1, f: (d) => { const b = R(3, 12 + Math.round(13 * d)), r = R(6, 15 + Math.round(40 * d)); return [`${b * r} ÷ ${b}`, r]; } },
  { min: 0.2, f: (d) => { const M = 60 + Math.round(900 * d), a = R(20, M), b = R(12, M), c = R(11, a + b - 1); return [`${a} + ${b} − ${c}`, a + b - c]; } },
  { min: 0.3, f: (d) => { const a = R(6, 15), b = R(6, 15 + Math.round(10 * d)), c = R(12, 99); return [`${a} × ${b} + ${c}`, a * b + c]; } },
  { min: 0.4, f: (d) => { const n = R(12, 15 + Math.round(30 * d)); return [`${n}²`, n * n]; } },
  { min: 0.45, f: () => { const a = R(3, 30), b = R(3, 30), c = R(3, 12); return [`(${a} + ${b}) × ${c}`, (a + b) * c]; } },
  { min: 0.5, f: () => { const p = pick([5, 15, 20, 25, 30, 35, 40, 60, 75]), x = 20 * R(3, 40); return [`${p} % de ${x}`, (p * x) / 100]; } },
  { min: 0.6, f: (d) => { const a = R(12, 25 + Math.round(40 * d)), b = R(11, 19 + Math.round(30 * d)); return [`${a} × ${b}`, a * b]; } },
];

export function mentalQuestion(level: number): { q: string; r: number; seconds: number } {
  const d = Math.max(0, Math.min(1, (level - 1) / 99));
  const dispo = TYPES.filter((t) => t.min <= d);
  const weight = (t: Gen) => 1 + 4 * t.min;
  let x = Math.random() * dispo.reduce((s, t) => s + weight(t), 0);
  const t = dispo.find((g) => (x -= weight(g)) < 0) ?? dispo[0];
  const [q, r] = t.f(d);
  return { q, r, seconds: +(15 - 9 * d).toFixed(1) };
}
