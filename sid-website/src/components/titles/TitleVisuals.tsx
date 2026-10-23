"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { TITLE_BY_ID, titleLabel, type TitleId } from "@/lib/titles";

/** "#ff7a2f" -> "255 122 47" (pour rgb(var(--x) / alpha), compatible vieux Safari). */
function rgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function titleStyle(id: TitleId): CSSProperties {
  const t = TITLE_BY_ID[id];
  return {
    ["--t1" as string]: t.colors[0],
    ["--t2" as string]: t.colors[1],
    ["--t1-rgb" as string]: rgbTriplet(t.colors[0]),
    ["--t2-rgb" as string]: rgbTriplet(t.colors[1]),
  };
}

/** Petit badge animé : à côté d'un nom (trombinoscope, messagerie, classement…). */
export function TitleBadge({
  titleId,
  level = 1,
  size = "sm",
  dragon = false,
  className = "",
}: {
  titleId: TitleId;
  level?: number;
  size?: "xs" | "sm" | "md";
  dragon?: boolean;
  className?: string;
}) {
  const t = TITLE_BY_ID[titleId];
  if (!t) return null;
  return (
    <span
      className={`title-badge title-badge-${size} ${dragon ? "title-badge-dragon" : ""} ${className}`}
      style={titleStyle(titleId)}
      title={dragon ? `${t.name} — forme draconique` : titleLabel(titleId, level)}
    >
      <span aria-hidden className="title-badge-emoji">{dragon ? "🐉" : t.emoji}</span>
      <span className="title-badge-text">{dragon ? "Forme draconique" : titleLabel(titleId, level)}</span>
    </span>
  );
}

// Pseudo-hasard stable (même rendu à chaque affichage).
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZÉÈÇ&§¶æœ".split("");

const PARTICLES: Partial<Record<TitleId, { count: number; glyphs?: string[] }>> = {
  dragon: { count: 22 },
  fantome: { count: 7 },
  mecene: { count: 26 },
  abyssal: { count: 18 },
  magnat: { count: 14 },
  flatteur: { count: 14, glyphs: ["♥", "♡", "♥"] },
  arpenteur: { count: 28, glyphs: ["✦", "·", "✧", "·"] },
  scribe: { count: 18, glyphs: LETTERS },
  metronome: { count: 3 },
  chauvesouris: { count: 12 },
  lutin: { count: 24, glyphs: ["❄", "❅", "❆", "·"] },
  cupidon: { count: 16, glyphs: ["♥", "❤", "♡"] },
  farceur: { count: 9 },
  chasseur: { count: 12 },
  meneur: { count: 20, glyphs: ["•", "•", "◦"] },
  maestro: { count: 14, glyphs: ["♪", "♫", "♬", "♩"] },
  artificier: { count: 24 },
  veilleur: { count: 10, glyphs: ["✿", "❀"] },
};

/**
 * Calque d'animation du titre : se place DANS une carte en position relative
 * (le contenu de la carte doit être au-dessus : `relative z-[1]`).
 */
export function TitleAuraLayer({ titleId, dragon = false, compact = false }: { titleId: TitleId; dragon?: boolean; compact?: boolean }) {
  const spec = PARTICLES[titleId];
  const parts = useMemo(() => {
    if (!spec) return [];
    return Array.from({ length: compact ? Math.ceil(spec.count / 2) : spec.count }, (_, i) => {
      const glyph = spec.glyphs ? spec.glyphs[Math.floor(rnd(i, 9) * spec.glyphs.length)] : null;
      const style: CSSProperties = {
        left: `${(rnd(i, 1) * 100).toFixed(1)}%`,
        top: `${(rnd(i, 2) * 100).toFixed(1)}%`,
        animationDelay: `${(-rnd(i, 3) * 8).toFixed(2)}s`,
        animationDuration: `${(4 + rnd(i, 4) * 5).toFixed(2)}s`,
        ["--s" as string]: (0.6 + rnd(i, 5) * 0.9).toFixed(2),
        ["--h" as string]: Math.floor(rnd(i, 6) * 360),
        ["--dx" as string]: `${((rnd(i, 7) - 0.5) * 60).toFixed(0)}px`,
      };
      return { i, glyph, style };
    });
  }, [spec, compact]);

  return (
    <div className={`aura-layer aura-${titleId}`} style={titleStyle(titleId)} aria-hidden>
      {parts.map((p) => (
        <span key={p.i} className="aura-p" style={p.style}>
          {p.glyph}
        </span>
      ))}

      {titleId === "architecte" && (
        <svg className="aura-circuit" viewBox="0 0 400 140" preserveAspectRatio="none">
          {[
            "M0 30 H90 L120 60 H220 L250 30 H400",
            "M0 110 H60 L90 80 H180 L210 110 H330 L360 80 H400",
            "M140 0 V40 L170 70 V140",
            "M300 0 V50 L270 80 V140",
          ].map((d, i) => (
            <path key={i} d={d} className="aura-trace" style={{ animationDelay: `${-i * 1.3}s` }} />
          ))}
          {[[120, 60], [220, 60], [90, 80], [210, 110], [170, 70], [270, 80], [250, 30], [360, 80]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.5" className="aura-node" style={{ animationDelay: `${-i * 0.4}s` }} />
          ))}
        </svg>
      )}

      {titleId === "foudre" && (
        <svg className="aura-bolts" viewBox="0 0 400 140" preserveAspectRatio="none">
          <path className="aura-bolt b1" d="M300 0 L280 52 L302 52 L270 140 L322 40 L298 40 L318 0 Z" />
          <path className="aura-bolt b2" d="M60 0 L48 40 L64 40 L36 110 L78 30 L60 30 L74 0 Z" />
          <path className="aura-bolt b3" d="M190 0 L182 30 L194 30 L176 80 L204 22 L192 22 L200 0 Z" />
        </svg>
      )}

      {titleId === "fantome" && <div className="aura-scan" />}

      {titleId === "flatteur" && (
        <div className="aura-ticker">
          <span>▲ TU ES LE MEILLEUR +100 % ▲ COURS AU PLUS HAUT ▲ ACHAT ! ACHAT ! ▲ TU ES LE MEILLEUR +100 % ▲ COURS AU PLUS HAUT ▲ ACHAT ! ACHAT ! </span>
        </div>
      )}

      {titleId === "arpenteur" && (
        <svg className="aura-compass" viewBox="-50 -50 100 100">
          <circle r="44" className="ring" />
          <circle r="30" className="ring thin" />
          <path d="M0 -46 L6 0 L0 46 L-6 0 Z" className="needle" />
          <path d="M-46 0 L0 6 L46 0 L0 -6 Z" className="needle dim" />
          <path d="M0 -46 L6 0 L-6 0 Z" className="north" />
        </svg>
      )}

      {titleId === "metronome" && (
        <div className="aura-pendulum">
          <i />
        </div>
      )}

      {titleId === "juriste" && (
        <>
          <div className="aura-fineprint">
            {Array.from({ length: 14 }, (_, i) => (
              <p key={i}>
                ARTICLE {i + 1}.{(i * 7) % 10} — Le soussigné reconnaît avoir lu l&apos;intégralité des présentes, y compris
                la présente ligne, et renonce à toute réclamation relative aux petites lignes.
              </p>
            ))}
          </div>
          <div className="aura-seal">S.I.D.</div>
        </>
      )}

      {titleId === "magnat" && <div className="aura-sheen" />}
      {titleId === "abyssal" && <div className="aura-caustics" />}
      {titleId === "dragon" && <div className="aura-heat" />}

      {dragon && (
        <div className="aura-dragon-form">
          <DragonSvg />
        </div>
      )}
    </div>
  );
}

/** Silhouette de dragon (profil gauche), ailes animées. */
export function DragonSvg({ className = "", breathing = false }: { className?: string; breathing?: boolean }) {
  return (
    <svg viewBox="0 0 420 280" className={`dragon-svg ${breathing ? "dragon-breathing" : ""} ${className}`} aria-hidden>
      <defs>
        <linearGradient id="dg-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a1212" />
          <stop offset="0.6" stopColor="#2a0707" />
          <stop offset="1" stopColor="#120304" />
        </linearGradient>
        <linearGradient id="dg-wing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a1a14" />
          <stop offset="1" stopColor="#2a0807" />
        </linearGradient>
        <radialGradient id="dg-fire" cx="1" cy="0.5" r="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.25" stopColor="#ffb02e" />
          <stop offset="0.6" stopColor="#ff4d1a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#7a0a00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="dragon-wing-back">
        <path d="M215 122 L172 28 L206 56 L214 8 L240 62 L270 22 L273 82 L312 60 L292 120 Z" fill="#240707" />
      </g>
      <path
        d="M248 164 C300 174 340 200 360 230 C372 248 392 250 405 236 L400 258 L381 250 C350 254 328 226 298 206 C279 193 262 187 243 183 Z"
        fill="url(#dg-body)"
      />
      <path d="M398 238 L418 226 L410 250 Z" fill="#1a0505" />
      <path d="M120 120 C152 104 212 110 252 140 C272 157 268 186 244 193 C208 203 164 196 139 178 C119 164 110 140 120 120 Z" fill="url(#dg-body)" />
      <path
        d="M136 130 C110 110 96 86 81 71 C71 61 56 58 41 62 L18 70 L31 76 L14 85 L41 87 C56 89 63 97 73 109 C86 125 101 141 126 151 Z"
        fill="url(#dg-body)"
      />
      <path d="M57 61 L70 36 L68 63 Z M68 63 L92 45 L81 69 Z" fill="#160404" />
      <path d="M150 180 L139 226 L124 233 L151 235 L166 190 Z M226 189 L233 231 L218 239 L246 239 L246 192 Z" fill="#180505" />
      <g className="dragon-wing-front">
        <path d="M190 126 L128 18 L175 48 L186 -2 L216 52 L252 8 L257 76 L302 48 L281 117 C250 113 220 116 190 126 Z" fill="url(#dg-wing)" stroke="#8a2318" strokeWidth="2" />
        <path d="M190 126 L175 48 M190 126 L216 52 M190 126 L257 76" stroke="#3a0b08" strokeWidth="3" fill="none" />
      </g>
      <circle cx="44" cy="70" r="3.4" className="dragon-eye" />
      <ellipse cx="-60" cy="80" rx="80" ry="22" fill="url(#dg-fire)" className="dragon-fire" />
    </svg>
  );
}
