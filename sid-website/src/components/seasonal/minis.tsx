/**
 * Petits dessins des particules (cœurs, notes, pétales, flocons…), à la place
 * des caractères ♥ ♪ ✿ ❄. Ils font 1em et prennent la couleur du texte
 * (`currentColor`) : les règles CSS qui coloraient les caractères continuent
 * de marcher.
 */

export type MiniKind =
  | "heart"
  | "heartLine"
  | "note"
  | "notes"
  | "noteQuarter"
  | "noteBeam"
  | "blossom"
  | "petal"
  | "sakura"
  | "bubble"
  | "bell"
  | "snow"
  | "snowStar"
  | "sparkle"
  | "dot"
  | "bleuet"
  | "leaf";

const HEART = "M0 9.4 C-6.4 4.8 -10.4 1.2 -10.4 -3.6 C-10.4 -7.2 -7.7 -9.8 -4.7 -9.8 C-2.7 -9.8 -1 -8.7 0 -6.9 C1 -8.7 2.7 -9.8 4.7 -9.8 C7.7 -9.8 10.4 -7.2 10.4 -3.6 C10.4 1.2 6.4 4.8 0 9.4 Z";

function art(kind: MiniKind) {
  switch (kind) {
    case "heart":
      return (
        <>
          <path d={HEART} fill="currentColor" />
          <path d="M0 9.4 C4.6 6 8.8 2.6 10 -1.8 C8.4 2.2 4.6 5 0.6 6.6 Z" fill="#000" opacity="0.16" />
          <ellipse cx="-5" cy="-4.8" rx="2.6" ry="1.5" transform="rotate(-38 -5 -4.8)" fill="#fff" opacity="0.75" />
          <circle cx="-7.2" cy="-1.6" r="0.9" fill="#fff" opacity="0.55" />
        </>
      );
    case "heartLine":
      return (
        <>
          <path d={HEART} fill="currentColor" opacity="0.18" />
          <path d={HEART} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M-6.8 -4.6 C-6.2 -6.6 -4.6 -7.4 -3.2 -7.2" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
        </>
      );
    case "note":
      return (
        <>
          <ellipse cx="-3.4" cy="6.4" rx="4.4" ry="3.2" transform="rotate(-22 -3.4 6.4)" fill="currentColor" />
          <path d="M0 5.6 V-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M0 -10 C3.4 -8.4 7.6 -6 6.4 -0.6 C6 -3.8 3.6 -5.2 0 -5.6 Z" fill="currentColor" />
          <ellipse cx="-4.6" cy="5.4" rx="1.4" ry="0.8" transform="rotate(-22 -4.6 5.4)" fill="#fff" opacity="0.7" />
        </>
      );
    case "notes":
      return (
        <>
          <ellipse cx="-6.4" cy="7" rx="3.8" ry="2.8" transform="rotate(-22 -6.4 7)" fill="currentColor" />
          <ellipse cx="5.2" cy="4.4" rx="3.8" ry="2.8" transform="rotate(-22 5.2 4.4)" fill="currentColor" />
          <path d="M-3.4 6.2 V-7 M8.2 3.6 V-9.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M-4.3 -7.4 L9.1 -10.2 L9.1 -6.4 L-4.3 -3.6 Z" fill="currentColor" />
          <ellipse cx="-7.4" cy="6.2" rx="1.2" ry="0.7" transform="rotate(-22 -7.4 6.2)" fill="#fff" opacity="0.7" />
          <ellipse cx="4.2" cy="3.6" rx="1.2" ry="0.7" transform="rotate(-22 4.2 3.6)" fill="#fff" opacity="0.7" />
        </>
      );
    case "noteBeam":
      return (
        <>
          <ellipse cx="-6.4" cy="7" rx="3.8" ry="2.8" transform="rotate(-22 -6.4 7)" fill="currentColor" />
          <ellipse cx="5.2" cy="4.4" rx="3.8" ry="2.8" transform="rotate(-22 5.2 4.4)" fill="currentColor" />
          <path d="M-3.4 6.2 V-7 M8.2 3.6 V-9.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M-4.3 -7.4 L9.1 -10.2 L9.1 -7.6 L-4.3 -4.8 Z M-4.3 -2.8 L9.1 -5.6 L9.1 -3 L-4.3 -0.2 Z" fill="currentColor" />
        </>
      );
    case "noteQuarter":
      return (
        <>
          <ellipse cx="-2.4" cy="6.4" rx="4.4" ry="3.2" transform="rotate(-22 -2.4 6.4)" fill="currentColor" />
          <path d="M1 5.6 V-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="-3.6" cy="5.4" rx="1.4" ry="0.8" transform="rotate(-22 -3.6 5.4)" fill="#fff" opacity="0.7" />
        </>
      );
    case "blossom":
      return (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path d="M0 -1.5 C-4.4 -3 -5.4 -8 -3 -10.4 C-1.8 -11.2 -0.8 -10.4 0 -9.4 C0.8 -10.4 1.8 -11.2 3 -10.4 C5.4 -8 4.4 -3 0 -1.5 Z" fill="currentColor" />
              <path d="M0 -2.4 V-8" stroke="#fff" strokeWidth="0.7" opacity="0.55" strokeLinecap="round" />
            </g>
          ))}
          <circle r="2.6" fill="#ffd65a" />
          <circle r="1.1" fill="#e89a2a" />
        </>
      );
    case "petal":
      return (
        <>
          <path d="M0 -10 C5.6 -6 6.4 3.6 0 10 C-6.4 3.6 -5.6 -6 0 -10 Z" fill="currentColor" />
          <path d="M0 -7 C1.2 -2 1.2 3 0 8" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.6" strokeLinecap="round" />
          <path d="M0 10 C4.4 5.6 5.8 0 4.6 -4.6 C5.2 1.2 3.4 6 0 10 Z" fill="#000" opacity="0.1" />
        </>
      );
    case "sakura":
      return (
        <>
          <path d="M0 10 C-6.4 4 -6.6 -4 -3 -9.8 L-1.2 -7.4 L0 -9.6 L1.2 -7.4 L3 -9.8 C6.6 -4 6.4 4 0 10 Z" fill="currentColor" />
          <path d="M0 -6 V7" stroke="#fff" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
          <ellipse cx="-2.6" cy="-2" rx="1.2" ry="2.6" fill="#fff" opacity="0.35" />
        </>
      );
    case "bubble":
      return (
        <>
          <circle r="8.6" fill="currentColor" opacity="0.14" />
          <circle r="8.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M-5.6 -2.4 A6 6 0 0 1 -1.6 -6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <circle cx="3.6" cy="4" r="1" fill="#fff" opacity="0.5" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M0 -10 Q2.6 -10 3 -7" fill="none" stroke="#5fae6e" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M0 -7 C-4.6 -7 -6 -2.6 -6 1.4 L-7.4 4.6 L-4.6 3.6 L-2.4 5.6 L0 4 L2.4 5.6 L4.6 3.6 L7.4 4.6 L6 1.4 C6 -2.6 4.6 -7 0 -7 Z" fill="currentColor" />
          <path d="M2.2 -5.6 C4.6 -4 5 -1 5 1.6 L7.4 4.6 L4.6 3.6 C4.8 1 4.4 -3 2.2 -5.6 Z" fill="#000" opacity="0.1" />
          <ellipse cx="-2.6" cy="-2.4" rx="1.1" ry="2.2" fill="#fff" opacity="0.8" />
        </>
      );
    case "snow":
      return (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
          {[0, 60, 120].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 -10 V10 M-2.8 -8 L0 -5.4 L2.8 -8 M-2.8 8 L0 5.4 L2.8 8 M-2 -3.4 L0 -1.8 L2 -3.4 M-2 3.4 L0 1.8 L2 3.4" />
          ))}
        </g>
      );
    case "snowStar":
      return (
        <>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 -1 L-1.8 -5 L0 -10.4 L1.8 -5 Z" fill="currentColor" />
          ))}
          <circle r="1.8" fill="#fff" opacity="0.8" />
        </>
      );
    case "sparkle":
      return (
        <>
          <path d="M0 -10.4 C1 -3.4 3.4 -1 10.4 0 C3.4 1 1 3.4 0 10.4 C-1 3.4 -3.4 1 -10.4 0 C-3.4 -1 -1 -3.4 0 -10.4 Z" fill="currentColor" />
          <circle r="1.6" fill="#fff" opacity="0.85" />
        </>
      );
    case "dot":
      return (
        <>
          <circle r="4" fill="currentColor" />
          <circle cx="-1.3" cy="-1.3" r="1.2" fill="#fff" opacity="0.6" />
        </>
      );
    case "bleuet":
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} transform={`rotate(${i * 45})`} d="M-1.2 -2.6 L-3.8 -8.6 L-2.6 -10 L-1.4 -8.8 L0 -10.6 L1.4 -8.8 L2.6 -10 L3.8 -8.6 L1.2 -2.6 Z" fill="currentColor" />
          ))}
          <circle r="2.8" fill="#2b2366" />
          <circle cx="-0.8" cy="-0.8" r="0.8" fill="#9b80f0" />
        </>
      );
    case "leaf":
      return (
        <>
          <path d="M-8 8 C-9 -2 -2 -9 9 -9 C9 2 2 9 -8 8 Z" fill="currentColor" />
          <path d="M-8 8 C-3 3 2 -2 7 -7" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.5" strokeLinecap="round" />
        </>
      );
  }
}

/** Un petit dessin de 1em, à la couleur du texte. */
export function Mini({ kind, className = "", style }: { kind: MiniKind; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-12 -12 24 24" width="1em" height="1em" className={`mini mini-${kind} ${className}`} style={{ display: "block", overflow: "visible", ...style }} aria-hidden>
      {art(kind)}
    </svg>
  );
}

/** Le même dessin, en groupe SVG (dans un autre dessin) : `size` en unités du dessin parent. */
export function MiniArt({ kind, size = 24, x = 0, y = 0, color, className }: { kind: MiniKind; size?: number; x?: number; y?: number; color?: string; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${(size / 24).toFixed(3)})`} style={color ? { color } : undefined} className={className}>
      {art(kind)}
    </g>
  );
}

/** Caractère d'autrefois → petit dessin. */
export const MINI_FOR_GLYPH: Record<string, MiniKind> = {
  "♥": "heart",
  "❤": "heart",
  "♡": "heartLine",
  "♪": "note",
  "♫": "notes",
  "♬": "noteBeam",
  "♩": "noteQuarter",
  "✿": "blossom",
  "❀": "blossom",
  "❁": "sakura",
  "❋": "bleuet",
  "❄": "snow",
  "❅": "snowStar",
  "❆": "snow",
  "✦": "sparkle",
  "✧": "sparkle",
  "•": "dot",
  "◦": "bubble",
  "○": "bubble",
  "°": "bubble",
};

/** Le petit dessin d'un caractère, sinon le caractère tel quel (lettres du Scribe, etc.). */
export function MiniGlyph({ g, className }: { g: string; className?: string }) {
  const kind = MINI_FOR_GLYPH[g.replace(/️/g, "")];
  return kind ? <Mini kind={kind} className={className} /> : <>{g}</>;
}
