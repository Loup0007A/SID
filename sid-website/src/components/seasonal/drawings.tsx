/**
 * Petits dessins des fêtes, partagés par les décors, les farces et leurs
 * aperçus. À part du module des décors pour que les farces et la page des
 * titres ne chargent pas toutes les scènes des fêtes.
 */

export function HeartPath({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 30" className={className} style={style} aria-hidden>
      <path d="M16 28 C6 20 1 14 1 8.5 C1 4 4.5 1 8.5 1 C11.6 1 14.3 2.8 16 5.6 C17.7 2.8 20.4 1 23.5 1 C27.5 1 31 4 31 8.5 C31 14 26 20 16 28 Z" />
    </svg>
  );
}

export function PaperFish({ color = "#ff9a76", className = "", style }: { color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 34" className={`hd-fish ${className}`} style={style} aria-hidden>
      <path d="M6 17 C14 4 34 2 46 12 L58 4 L56 17 L58 30 L46 22 C34 32 14 30 6 17 Z" fill={color} />
      <path d="M22 7 C26 12 26 22 22 27 M30 6 C34 12 34 22 30 28" fill="none" stroke="rgb(0 0 0 / 0.18)" strokeWidth="1.6" />
      <circle cx="14" cy="15" r="2.6" fill="#fff" />
      <circle cx="13.4" cy="15.2" r="1.3" fill="#1b1b24" />
      <path d="M9 21 Q11 22.5 13 21" fill="none" stroke="#1b1b24" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function Egg({ hue = 0, className = "", style }: { hue?: number; className?: string; style?: React.CSSProperties }) {
  const colors = ["#ffb3c7", "#b8e0ff", "#ffe08a", "#c7f0b8", "#d9c2ff", "#ffc999"];
  const c = colors[hue % colors.length];
  const c2 = colors[(hue + 2) % colors.length];
  return (
    <svg viewBox="0 0 24 30" className={`hd-egg ${className}`} style={style} aria-hidden>
      <path d="M12 1 C5 1 1 12 1 18 C1 25 6 29 12 29 C18 29 23 25 23 18 C23 12 19 1 12 1 Z" fill={c} />
      <path d="M2 15 Q7 12 12 15 T22 15 L22.6 18.5 Q17 15.5 12 18.5 T1.4 18.5 Z" fill={c2} />
      <circle cx="7" cy="23" r="1.4" fill="#fff" opacity="0.8" />
      <circle cx="12" cy="24.5" r="1.4" fill="#fff" opacity="0.8" />
      <circle cx="17" cy="23" r="1.4" fill="#fff" opacity="0.8" />
      <ellipse cx="8" cy="8" rx="2" ry="3.4" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** Tête de bleuet : fleurons dentelés sur deux rangs, cœur sombre aux étamines violettes. */
export function BleuetHead() {
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 40})`}>
          <path d="M-1.8 -4.2 L-6.4 -15.4 L-5 -17.8 L-3.4 -16 L-2 -18.8 L-0.4 -16.6 L1.2 -19 L2.6 -16.2 L4.4 -17.6 L5.6 -15 L1.8 -4.2 Z" fill="#3b69e3" />
          <path d="M-0.9 -5 L-3.4 -14.2 L0 -13 L3 -14.4 L0.9 -5 Z" fill="#2147b5" opacity="0.55" />
          <path d="M-5 -16.8 L-3.4 -16 L-2 -18.8 L-0.4 -16.6 L1.2 -19 L2.6 -16.2 L4.4 -17.6" fill="none" stroke="#86a8ff" strokeWidth="0.7" strokeLinejoin="round" />
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <path key={`b${i}`} transform={`rotate(${i * 40 + 20})`} d="M-1.2 -3.6 L-3.6 -10.4 L-2.2 -11.6 L-1 -10.6 L0 -12.2 L1 -10.6 L2.2 -11.6 L3.6 -10.4 L1.2 -3.6 Z" fill="#5c80f0" />
      ))}
      <circle r="4.6" fill="#2a2266" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={`s${i}`} cx={(Math.cos(a) * 2.8).toFixed(2)} cy={(Math.sin(a) * 2.8).toFixed(2)} r="0.95" fill="#9b80f0" />;
      })}
      <circle r="1.1" fill="#c8b6ff" />
    </>
  );
}

export function Bleuet({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-20 -20 40 40" className={`hd-bleuet ${className}`} style={style} aria-hidden>
      <BleuetHead />
    </svg>
  );
}

/** Bleuet sur sa tige, avec ses feuilles fines et un bouton. */
export function BleuetStem({ className = "", style, bud = true }: { className?: string; style?: React.CSSProperties; bud?: boolean }) {
  return (
    <svg viewBox="0 0 40 90" className={`hd-bleuet-stem ${className}`} style={style} aria-hidden>
      <path d="M20 90 C19 70 22 48 20 24" fill="none" stroke="#5f7f62" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.4 62 C14 56 9 50 6 40 C12 46 16 52 20.6 56 Z" fill="#6f9271" />
      <path d="M20.2 74 C26 68 31 62 33 54 C28 60 24 64 20.2 68 Z" fill="#7aa07b" />
      {bud && (
        <>
          <path d="M20.6 50 C24 44 28 40 31 36" fill="none" stroke="#5f7f62" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M31 36 C29 32 31 28 34 27 C36 29 36 33 33.6 36 Z" fill="#6f9271" />
          <path d="M32.4 28.4 L33.4 25.6 L34.6 28" fill="#3b69e3" />
        </>
      )}
      <path d="M20 26 C17.6 26 16.4 23 17 20.6 L23 20.6 C23.6 23 22.4 26 20 26 Z" fill="#6f9271" />
      <g transform="translate(20 15) scale(0.72)">
        <BleuetHead />
      </g>
    </svg>
  );
}

/** Clochette de muguet (posée sous sa petite tige, origine en haut). */
function Clochette({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0 0 C-3.4 0 -4.4 2.8 -4.4 5 L-5.2 6.8 L-3.4 6.1 L-1.8 7.2 L0 6.3 L1.8 7.2 L3.4 6.1 L5.2 6.8 L4.4 5 C4.4 2.8 3.4 0 0 0 Z" fill="#fdfff8" />
      <path d="M1.4 0.6 C3.2 1.4 3.8 3.4 3.8 5.2 L5.2 6.8 L3.4 6.1 C3.4 4 3 2 1.4 0.6 Z" fill="#d5e4cd" />
      <ellipse cx="-1.8" cy="2.6" rx="0.8" ry="1.5" fill="#fff" />
    </g>
  );
}

export function MuguetSprig({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const bells: [number, number, number][] = [
    [30.6, 14.6, 0.62],
    [29, 20.4, 0.76],
    [27.4, 26.6, 0.86],
    [25.9, 33, 0.94],
    [24.7, 39.6, 1],
    [23.8, 46.4, 1.04],
  ];
  return (
    <svg viewBox="0 0 44 64" className={`hd-muguet ${className}`} style={style} aria-hidden>
      {/* Feuilles larges, nervure claire */}
      <path d="M10.6 64 C1.6 50 2.4 26 14.6 7.6 C16.4 5.6 18.6 6.6 17.6 9.6 C11.4 26 12.2 46 16.6 64 Z" fill="#2c844b" />
      <path d="M13 64 C8.6 50 9 30 15.8 9 C11.4 26 12.4 46 16.6 64 Z" fill="#3b9d5b" />
      <path d="M13.4 62 C9.6 46 10.6 28 16 10.6" fill="none" stroke="#7cc98d" strokeWidth="0.7" opacity="0.7" />
      <path d="M35 64 C43 50 41 28 30.6 13.6 C28.8 11.8 26.8 13 27.8 15.8 C33.4 30 33 46 28.6 64 Z" fill="#37a05c" />
      <path d="M32.6 64 C37.4 50 36.4 32 29.4 15.4 C33.4 30 33 46 28.6 64 Z" fill="#2c8a4e" />
      <path d="M31.4 62 C34.6 48 34 32 29.2 17" fill="none" stroke="#86d297" strokeWidth="0.7" opacity="0.6" />
      {/* Hampe et clochettes */}
      <path d="M21.6 64 C20.6 46 22.6 28 32 10" fill="none" stroke="#6bb979" strokeWidth="1.4" strokeLinecap="round" />
      {bells.map(([x, y, s], i) => (
        <g key={i}>
          <path d={`M${x - 2.2} ${y - 1.6} Q${x + 1.6} ${y - 2.8} ${x + 3} ${y + 0.6}`} fill="none" stroke="#6bb979" strokeWidth="0.8" strokeLinecap="round" />
          <Clochette x={x + 3} y={y + 0.4} s={s} />
        </g>
      ))}
      <ellipse cx="32.6" cy="9.4" rx="1.6" ry="2.2" fill="#a9dcae" />
    </svg>
  );
}

export function Bells() {
  return (
    <svg viewBox="0 0 120 80" className="hd-fly-art" aria-hidden>
      {[
        [40, 28, -12],
        [78, 22, 10],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`} className="hd-bell">
          <path d="M-16 18 C-16 2 -10 -12 0 -12 C10 -12 16 2 16 18 L20 22 L-20 22 Z" />
          <circle cy="25" r="4" className="hd-bell-clapper" />
          <path d="M-6 -12 C-14 -24 -4 -26 0 -16 C4 -26 14 -24 6 -12" className="hd-ribbon" />
        </g>
      ))}
      <g className="hd-drop-eggs">
        <ellipse cx="44" cy="62" rx="4" ry="5.2" fill="#ffb3c7" />
        <ellipse cx="80" cy="70" rx="4" ry="5.2" fill="#b8e0ff" />
      </g>
    </svg>
  );
}

export function Patrouille() {
  const v = [
    [0, 0],
    [-14, -8],
    [-14, 8],
    [-28, -16],
    [-28, 16],
    [-42, -24],
    [-42, 24],
    [-28, 0],
    [-42, 0],
  ];
  return (
    <svg viewBox="-200 -40 260 80" className="hd-fly-art hd-patrouille" aria-hidden>
      <rect x="-200" y="-7" width="160" height="4" className="hd-smoke-b" />
      <rect x="-200" y="-1.5" width="160" height="4" className="hd-smoke-w" />
      <rect x="-200" y="4" width="160" height="4" className="hd-smoke-r" />
      {v.map(([x, y], i) => (
        <path key={i} transform={`translate(${x + 20} ${y})`} className="hd-jet" d="M8 0 L-2 -1.6 L-6 -7 L-8 -7 L-6 -1.6 L-12 -1.4 L-14 -4 L-15 -4 L-14.2 0 L-15 4 L-14 4 L-12 1.4 L-6 1.6 L-8 7 L-6 7 L-2 1.6 Z" />
      ))}
    </svg>
  );
}

type BirdKind = "dove" | "pigeon";
const WING = "M90 44 C92 32 88 21 80 13 C72 7 60 3 46 2.6 C51 5.6 53.4 7.6 52.4 10.2 C46 10.6 40 12.6 35.4 16.4 C43 16.6 47 18.4 47.6 20.6 C41.6 22.4 37.6 26 35.4 30.4 C43.4 28.6 49.4 30 52 32.4 C48.4 35.6 46.4 39.6 46 44.4 C56 42.4 64 44 70 48.4 C78 49 85 47.4 90 44 Z";
const BIRD_COLORS: Record<BirdKind, { body: string; belly: string; wing: string; far: string; line: string; tail: string; beak: string; eye: string }> = {
  dove: { body: "#f8fafd", belly: "#dfe6f1", wing: "#ffffff", far: "#d2dae8", line: "#c6d0e2", tail: "#e7ecf4", beak: "#e2a07e", eye: "#1b1b24" },
  pigeon: { body: "#aab4c6", belly: "#939db0", wing: "#bcc5d4", far: "#8b95a8", line: "#7d879b", tail: "#9aa4b7", beak: "#3c3c48", eye: "#ff8a3a" },
};

/**
 * Colombe (ou pigeon) en vol, vue de profil et tournée vers la droite :
 * queue en éventail, ailes aux rémiges découpées (elles battent : classe
 * `hd-wing`), œil brillant, et ce qu'elle porte dans le bec.
 */
export function Bird({ kind = "dove", carry = "olive", className = "hd-dove" }: { kind?: BirdKind; carry?: "olive" | "muguet" | null; className?: string }) {
  const c = BIRD_COLORS[kind];
  return (
    <svg viewBox="0 -6 142 90" className="hd-fly-art" aria-hidden>
      <g className={className}>
        {/* Aile du fond */}
        <g className="hd-wing">
          <path transform="translate(10 -4) rotate(4 90 44)" d={WING} fill={c.far} />
        </g>
        {/* Queue en éventail */}
        <path d="M46 47 C34 44 20 39 7 38 C9.6 43 11 47 9 52 C11 54.6 12 56 10 60 C22 60 36 57 48 54 Z" fill={c.tail} />
        <path d="M10 45 C22 46.4 33 47.6 44 49 M11 52.6 C22 52.6 33 52.2 44 51.6" fill="none" stroke={c.line} strokeWidth="0.9" strokeLinecap="round" />
        {kind === "pigeon" && <path d="M7 38 C9.6 43 11 47 9 52 C11 54.6 12 56 10 60 L16 59.6 C17.6 52 17 45 14 38.4 Z" fill="#4c5568" />}
        {/* Corps */}
        <path d="M42 50 C48 40 62 36 78 38 C86 38.4 92 34.6 96 30.6 C100 26.4 108 26 112 30 C115.4 33.4 115 38.6 111.6 41.6 C107.4 46 101.4 50 95.4 54 C83 62.4 61 64.4 47 58.4 C43.6 56.8 41.6 53.6 42 50 Z" fill={c.body} />
        <path d="M48 58.4 C62 63.6 82 61.6 95.4 54 C89 60.6 77 64.6 63 64.6 C55 64.6 50.4 62.4 48 58.4 Z" fill={c.belly} />
        {kind === "pigeon" && (
          <>
            <path d="M97 33.6 C99.6 37 100.6 40.6 99.6 44.4 C102.4 42.6 105 40.4 106.6 38.4 C103.6 37.4 100.4 36 98.4 32 Z" fill="#5db58b" opacity="0.75" />
            <path d="M98.6 40.6 C100.4 42.4 100.8 44.2 99.8 46.2 C102 45 103.8 43.6 104.8 42.2 C102.6 42 100.6 41.4 98.6 40.6 Z" fill="#a679d6" opacity="0.7" />
          </>
        )}
        {/* Tête */}
        <circle cx="106.6" cy="31.2" r="2.6" fill={kind === "pigeon" ? "#ffd2a8" : "#e8edf5"} />
        <circle cx="106.6" cy="31.2" r="1.7" fill={c.eye} />
        <circle cx="106" cy="30.5" r="0.6" fill="#fff" />
        <path d="M113.2 32.4 L121.4 34.6 L113.4 37.4 Z" fill={c.beak} />
        <path d="M112.6 32 C114 31.4 115.4 32 115.8 33.2" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
        {/* Aile de devant : couvertures puis rémiges découpées */}
        <g className="hd-wing">
        <path
          d={WING}
          fill={c.wing}
        />
        <g fill="none" stroke={c.line} strokeWidth="1" strokeLinecap="round">
          <path d="M86 30.6 C76 24 64 22 51 24.4" />
          <path d="M79 14.4 C68 10 58 7.6 49 6 M77 19 C66 16.4 54 16 42 16.6 M75 25 C65 25 55 26.4 42 28.6 M73 33 C65 34.6 58 37 51 40.6" opacity="0.85" />
          {kind === "pigeon" && <path d="M82 36 C74 34 66 34 58 36 M80 41 C72 39.6 64 40 56 42" stroke="#3e4658" strokeWidth="2.2" />}
        </g>
        </g>
        {/* Ce qu'elle porte */}
        {carry === "olive" && (
          <g>
            <path d="M115.6 35.6 C121 38.6 127 39.4 135 45.6" fill="none" stroke="#6b7f3a" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="121.6" cy="33.6" rx="5.4" ry="1.9" transform="rotate(-24 121.6 33.6)" fill="#93b85c" />
            <ellipse cx="127" cy="43.6" rx="5.2" ry="1.8" transform="rotate(34 127 43.6)" fill="#7ca24a" />
            <ellipse cx="131" cy="38.6" rx="5" ry="1.7" transform="rotate(-14 131 38.6)" fill="#8fb35a" />
            <ellipse cx="136.6" cy="49.6" rx="4.6" ry="1.6" transform="rotate(48 136.6 49.6)" fill="#7ca24a" />
            <path d="M119 36 L121.6 33.6 M126.6 40.6 L127 43.6 M130.4 42.6 L131 38.6" stroke="#6b7f3a" strokeWidth="0.8" />
            <circle cx="124.6" cy="44.4" r="1.9" fill="#4b5e2b" />
            <circle cx="132.6" cy="46.6" r="1.7" fill="#56692f" />
            <circle cx="124" cy="43.8" r="0.5" fill="#fff" opacity="0.6" />
          </g>
        )}
        {carry === "muguet" && (
          <g transform="translate(116 33) rotate(24) scale(0.56)">
            <path d="M0 4 C8 6 16 8 26 4" fill="none" stroke="#6bb979" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M6 6 C4 14 8 22 14 26 C12 18 12 12 10 6 Z" fill="#37a05c" />
            {[[12, 5.6, 1], [18, 6.4, 1.08], [24, 5, 0.9]].map(([x, y, s], i) => (
              <g key={i}>
                <path d={`M${x} ${y} q1 2 1 4`} fill="none" stroke="#6bb979" strokeWidth="1.2" />
                <Clochette x={x + 1} y={y + 4} s={s * 1.5} />
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}

export function Dove() {
  return <Bird kind="dove" carry="olive" className="hd-dove" />;
}

export function Pigeon() {
  return <Bird kind="pigeon" carry="muguet" className="hd-pigeon" />;
}

/** Tulipe des prés (origine au sol) : trois pétales, une feuille. */
export function Tulip({ x, y, s = 1, color, lean = 0 }: { x: number; y: number; s?: number; color: [string, string, string]; lean?: number }) {
  const [dark, base, light] = color;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)}) rotate(${lean.toFixed(1)})`}>
      <path d="M0 0 C1.4 -8 -1 -16 0 -22" fill="none" stroke="#4d9a50" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M0.4 -1 C-8 -5 -10 -14 -6.6 -21 C-5.6 -13 -3 -8.6 0.6 -6 Z" fill="#5fb060" />
      <path d="M-6.6 -21 C-5.6 -13 -3 -8.6 0.6 -6 L0.4 -4 C-3.4 -7 -6.2 -12 -6.6 -21 Z" fill="#46934a" />
      <path d="M-5.4 -21.6 C-6.6 -27.6 -4.6 -32.6 0 -34 C4.6 -32.6 6.6 -27.6 5.4 -21.6 C3.4 -19.4 -3.4 -19.4 -5.4 -21.6 Z" fill={dark} />
      <path d="M-6 -22 C-7.6 -27 -5.6 -31.4 -2.8 -33.4 C-1.8 -29 -1.2 -25 0 -20.4 C-2.6 -19.8 -4.8 -20.4 -6 -22 Z" fill={base} />
      <path d="M6 -22 C7.6 -27 5.6 -31.4 2.8 -33.4 C1.8 -29 1.2 -25 0 -20.4 C2.6 -19.8 4.8 -20.4 6 -22 Z" fill={base} />
      <path d="M-2.6 -20.8 C-3.2 -26 -1.6 -31 0 -33.2 C1.6 -31 3.2 -26 2.6 -20.8 C1 -20 -1 -20 -2.6 -20.8 Z" fill={light} />
      <path d="M-4.6 -24 C-5 -27 -4 -29.6 -2.8 -31" fill="none" stroke="#fff" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}

/** Pâquerette (origine au sol). */
export function Daisy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`}>
      <path d="M0 0 C-1 -6 1 -12 0 -16" fill="none" stroke="#5aa25c" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M0 -4 C-4 -5 -6 -8 -6 -10 C-3 -9.6 -1 -7.6 0 -5.6 Z" fill="#5fb060" />
      <g transform="translate(0 -18)">
        {Array.from({ length: 14 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-4.6" rx="1.35" ry="3.6" transform={`rotate(${(i * 360) / 14})`} fill={i % 2 ? "#ffffff" : "#f6f1ff"} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={`t${i}`} cx="0" cy="-6.6" rx="0.9" ry="1.2" transform={`rotate(${(i * 360) / 7 + 12})`} fill="#ff9ec0" opacity="0.55" />
        ))}
        <circle r="2.6" fill="#ffcc33" />
        <circle cx="0.7" cy="0.8" r="1.3" fill="#e8a21c" opacity="0.6" />
      </g>
    </g>
  );
}
