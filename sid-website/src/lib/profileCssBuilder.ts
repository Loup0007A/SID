/**
 * Génère du CSS à partir d'options simples (couleurs, formes, ombre,
 * animation) — aucune notion de code pour la personne qui règle ça.
 *
 * Le texte généré est enregistré exactement comme du CSS "avancé" tapé à
 * la main (même colonne, même `set_profile_css`) : il repasse donc par le
 * même nettoyeur (`scopeAndSanitizeCss`) à chaque affichage, aucune
 * confiance particulière ne lui est accordée. Les animations elles-mêmes
 * (les `@keyframes`) sont définies une fois pour toutes dans globals.css
 * (jamais par l'utilisateur) ; ce fichier ne fait que référencer leur nom
 * et régler leur couleur/vitesse via des propriétés CSS classiques.
 *
 * Astuce : les options choisies sont encodées dans un commentaire CSS en
 * tête du texte généré (`/*BUILDER:{...}*\/`), pour pouvoir rouvrir
 * l'éditeur visuel plus tard avec les mêmes réglages. Ce commentaire est
 * toujours retiré par le nettoyeur avant affichage — il n'apparaît jamais
 * pour les autres visiteurs.
 */

export type AnimationPreset = "none" | "glow-pulse" | "scale-pulse" | "float" | "shimmer" | "rainbow" | "neon-flicker";

export type AnimationSpeed = "slow" | "normal" | "fast";

export type BorderStyle = "none" | "solid" | "dashed" | "double";

export type BackgroundMode = "none" | "solid" | "gradient";

export interface CssBuilderOptions {
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number; // px
  borderRadius: number; // px
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientColor: string;
  gradientAngle: number; // degrés
  glowEnabled: boolean;
  glowColor: string;
  glowIntensity: number; // 0-100
  accentColor: string;
  animation: AnimationPreset;
  animationSpeed: AnimationSpeed;
}

export function defaultBuilderOptions(seedColor: string): CssBuilderOptions {
  return {
    borderStyle: "solid",
    borderColor: seedColor,
    borderWidth: 1,
    borderRadius: 12,
    backgroundMode: "none",
    backgroundColor: "#1b1e27",
    gradientColor: seedColor,
    gradientAngle: 135,
    glowEnabled: true,
    glowColor: seedColor,
    glowIntensity: 35,
    accentColor: seedColor,
    animation: "glow-pulse",
    animationSpeed: "normal",
  };
}

const SPEED_MULTIPLIER: Record<AnimationSpeed, number> = { slow: 1.6, normal: 1, fast: 0.55 };

/** Durée de base (avant application du multiplicateur de vitesse), par animation. */
const BASE_DURATION: Record<Exclude<AnimationPreset, "none">, number> = {
  "glow-pulse": 2.2,
  "scale-pulse": 2.4,
  float: 3,
  shimmer: 2.6,
  rainbow: 5,
  "neon-flicker": 2.6,
};

function duration(preset: Exclude<AnimationPreset, "none">, speed: AnimationSpeed): string {
  return `${(BASE_DURATION[preset] * SPEED_MULTIPLIER[speed]).toFixed(2)}s`;
}

function clampHex(color: string, fallback: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color.trim()) ? color.trim() : fallback;
}

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** L'élément d'accent (texte) propre à chaque zone — c'est lui que colore `accentColor` et qui reçoit "Néon clignotant". */
export function accentSelectorFor(section: "org_chart" | "roster" | "leaderboard" | "profile"): string {
  return section === "profile" ? ".rank-card-letter" : ".font-display";
}

/** Construit le CSS complet (carte + accent + animation) pour une zone donnée. */
export function buildCss(section: "org_chart" | "roster" | "leaderboard" | "profile", raw: CssBuilderOptions): string {
  const o: CssBuilderOptions = {
    ...raw,
    borderColor: clampHex(raw.borderColor, "#8fb3d9"),
    backgroundColor: clampHex(raw.backgroundColor, "#1b1e27"),
    gradientColor: clampHex(raw.gradientColor, "#8fb3d9"),
    glowColor: clampHex(raw.glowColor, "#8fb3d9"),
    accentColor: clampHex(raw.accentColor, "#8fb3d9"),
    borderWidth: clampNum(raw.borderWidth, 0, 6),
    borderRadius: clampNum(raw.borderRadius, 0, 32),
    gradientAngle: clampNum(raw.gradientAngle, 0, 360),
    glowIntensity: clampNum(raw.glowIntensity, 0, 100),
  };

  const cardDecls: string[] = [];

  if (o.borderStyle !== "none" && o.borderWidth > 0) {
    cardDecls.push(`border: ${o.borderWidth}px ${o.borderStyle} ${o.borderColor}`);
  }
  cardDecls.push(`border-radius: ${o.borderRadius}px`);

  if (o.backgroundMode === "solid") {
    cardDecls.push(`background: ${o.backgroundColor}`);
  } else if (o.backgroundMode === "gradient") {
    cardDecls.push(`background: linear-gradient(${o.gradientAngle}deg, ${o.backgroundColor}, ${o.gradientColor})`);
  }

  if (o.glowEnabled && o.glowIntensity > 0) {
    const blur = Math.round(6 + o.glowIntensity * 0.35);
    const spread = Math.round(o.glowIntensity * 0.04);
    const alpha = (0.25 + (o.glowIntensity / 100) * 0.55).toFixed(2);
    cardDecls.push(`box-shadow: 0 0 ${blur}px ${spread}px ${hexToRgba(o.glowColor, alpha)}`);
  }

  let animBlock = "";
  if (o.animation !== "none" && o.animation !== "neon-flicker") {
    cardDecls.push(`animation: profile-${o.animation} ${duration(o.animation, o.animationSpeed)} ease-in-out infinite`);
    if (o.animation === "shimmer") {
      cardDecls.push(`background-size: 250% 100%`);
    }
  } else if (o.animation === "neon-flicker") {
    animBlock = `\n${accentSelectorFor(section)} {\n  animation: profile-neon-flicker ${duration("neon-flicker", o.animationSpeed)} linear infinite;\n  --neon-color: ${o.accentColor};\n}\n`;
  }

  const accentBlock =
    o.animation === "neon-flicker"
      ? "" // la couleur d'accent est déjà posée via --neon-color ci-dessus
      : `\n${accentSelectorFor(section)} {\n  color: ${o.accentColor};\n}\n`;

  const comment = `/*BUILDER:${JSON.stringify(o)}*/\n`;
  const cardRule = cardDecls.length > 0 ? `${cardDecls.join(";\n")};\n` : "";

  return `${comment}${cardRule}${accentBlock}${animBlock}`.trim() + "\n";
}

/** Relit les options depuis le commentaire de tête, si le CSS a bien été généré par l'éditeur visuel. */
export function parseBuilderOptions(css: string | null | undefined): CssBuilderOptions | null {
  if (!css) return null;
  const m = css.match(/^\/\*BUILDER:([\s\S]*?)\*\//);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as CssBuilderOptions;
  } catch {
    return null;
  }
}

function hexToRgba(hex: string, alpha: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const ANIMATION_LABELS: Record<AnimationPreset, string> = {
  none: "Aucune",
  "glow-pulse": "Lueur pulsée",
  "scale-pulse": "Pulsation douce",
  float: "Flottement",
  shimmer: "Reflet brillant",
  rainbow: "Aura arc-en-ciel",
  "neon-flicker": "Néon clignotant (texte)",
};
