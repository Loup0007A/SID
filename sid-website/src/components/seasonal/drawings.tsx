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

export function Bleuet({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="-20 -20 40 40" className={`hd-bleuet ${className}`} style={style} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M0 -3 L-4 -15 L-1.5 -13 L0 -17 L1.5 -13 L4 -15 Z" fill="#3f6fe0" transform={`rotate(${i * 45})`} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <path key={`b${i}`} d="M0 -3 L-2.6 -10 L0 -9 L2.6 -10 Z" fill="#6f95ff" transform={`rotate(${i * 45 + 22.5})`} />
      ))}
      <circle r="3.4" fill="#25307a" />
    </svg>
  );
}

export function MuguetSprig({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 60" className={`hd-muguet ${className}`} style={style} aria-hidden>
      <path d="M8 58 C2 40 6 18 16 6 C12 22 12 40 14 58 Z" fill="#2f8a4f" />
      <path d="M30 58 C38 42 34 22 26 12 C28 28 28 42 24 58 Z" fill="#3aa35e" />
      <path d="M19 58 C19 40 21 24 28 12" fill="none" stroke="#5fae6e" strokeWidth="1.4" />
      {[
        [27, 15],
        [25, 22],
        [23.5, 29],
        [22.5, 36],
        [21.8, 43],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 0 Q-2.5 1 -3 4.2 L-2 3.6 L-1 4.6 L0 3.8 L1 4.6 L2 3.6 L3 4.2 Q2.5 1 0 0 Z" fill="#fbfff7" />
        </g>
      ))}
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

export function Dove() {
  return (
    <svg viewBox="0 0 110 60" className="hd-fly-art" aria-hidden>
      <g className="hd-dove">
        <path d="M24 34 C36 26 58 24 72 30 C78 24 86 24 90 28 C84 30 82 34 82 38 C70 46 42 46 24 34 Z" />
        <path className="hd-wing" d="M46 30 C40 10 56 2 70 8 C60 14 58 22 58 30 Z" />
        <path d="M24 34 L10 28 L16 36 L8 42 L26 40 Z" />
        <circle cx="84" cy="29" r="1.1" className="hd-eye" />
      </g>
      <path d="M92 32 C98 34 102 30 106 33 M96 31 L98 27 M100 32 L102 28" className="hd-olive" />
    </svg>
  );
}
