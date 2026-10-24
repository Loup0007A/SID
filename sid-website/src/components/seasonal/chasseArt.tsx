import "./chasse-art.css";
import { useId } from "react";

/**
 * Dessins de « La Grande Chasse » (Lot 46), partagés par le décor, la farce
 * « Assaut de Brasombre » et la chasse du titre. Créature et motifs
 * originaux du S.I.D.
 *
 * Couleurs pilotées par des variables CSS (voir chasse-art.css) : la même
 * Brasombre sert pour les variantes Braise, Givre et Orage.
 */

export type BeastPose = "perch" | "fly";

/** Points faibles de Brasombre, en % de son dessin (pour la chasse). */
export const WEAK_POINTS = {
  tete: { x: 86, y: 31 },
  aile: { x: 37, y: 14 },
  queue: { x: 10, y: 63 },
  ventre: { x: 56, y: 63 },
  patte: { x: 55, y: 84 },
} as const;
export type WeakPoint = keyof typeof WEAK_POINTS;

function Wing({ far = false }: { far?: boolean }) {
  return (
    <g className={`br-wing ${far ? "br-wing-far" : "br-wing-near"}`}>
      <path
        className="br-membrane"
        d="M236 122 L214 74 L201 20 C186 14 166 8 150 8 C152 22 142 30 128 30 C120 30 112 30 106 32 C112 46 100 58 88 64 C98 80 100 92 98 104 C118 112 142 122 168 132 Z"
      />
      <path className="br-tatter" d="M150 8 L146 16 L140 12 L134 22 L128 30 M106 32 L100 40 L95 37 L92 48 L88 64 M98 104 L104 110 L112 108 L118 116" />
      <path className="br-bone" d="M236 122 L214 74 L201 20 M201 20 L150 8 M201 20 L106 32 M201 20 L88 64 M201 20 L98 104" />
      <circle className="br-claw-wing" cx="201" cy="20" r="3" />
    </g>
  );
}

/** Brasombre, la wyverne des cendres (regarde vers la droite). */
export function Brasombre({
  pose = "perch",
  className = "",
  style,
  width,
  height,
}: {
  pose?: BeastPose;
  className?: string;
  style?: React.CSSProperties;
  /** Pour l'insérer dans un autre dessin SVG. */
  width?: number;
  height?: number;
}) {
  // Identifiants propres à chaque dessin (plusieurs Brasombre peuvent cohabiter).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 420 280" width={width} height={height} className={`brasombre br-${pose} ${className}`} style={style} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-eye`}>
          <stop offset="0" stopColor="var(--br-glow2)" />
          <stop offset="0.5" stopColor="var(--br-glow)" stopOpacity="0.8" />
          <stop offset="1" stopColor="var(--br-glow)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-belly`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--br-plate)" />
          <stop offset="1" stopColor="var(--br-dark)" />
        </linearGradient>
      </defs>

      {/* Aile lointaine, derrière le corps */}
      <Wing far />

      {/* Queue, piquants, éventail de braises au bout */}
      <path className="br-body" d="M162 138 C122 132 82 140 50 156 C36 163 24 170 10 178 C24 177 38 173 52 170 C86 166 122 166 162 168 Z" />
      <path
        className="br-spike"
        d="M128 135 l5 -13 l6 12 Z M104 139 l5 -12 l5 12 Z M80 146 l4 -11 l5 11 Z M58 154 l4 -10 l4 10 Z M38 162 l3 -8 l4 8 Z"
      />
      <path className="br-tail-fan" d="M16 178 C4 174 -4 166 -6 156 C2 162 8 166 14 168 C6 160 4 150 8 140 C12 152 18 162 24 168 C22 160 24 152 30 146 C30 158 30 166 32 172 Z" />
      <path className="br-fissure" d="M60 162 L74 160 L82 164 L98 160 M112 159 L126 161" />

      {/* Patte lointaine */}
      {pose === "perch" ? (
        <path className="br-dark" d="M196 168 C206 176 210 190 204 208 L198 236 L212 246 L192 248 L182 244 L188 230 L186 208 C180 194 184 178 196 168 Z" />
      ) : (
        <path className="br-dark" d="M196 168 C206 174 210 184 202 194 L184 210 L172 214 L176 206 L190 194 C184 186 186 176 196 168 Z" />
      )}

      {/* Corps */}
      <path className="br-body" d="M150 140 C170 108 230 100 270 112 C292 118 304 132 300 150 C296 172 270 186 236 188 C200 190 168 184 152 170 C144 162 144 150 150 140 Z" />
      <path className="br-belly" fill={`url(#${uid}-belly)`} d="M168 172 C192 184 232 186 262 176 C276 170 288 160 292 150 C282 168 256 180 226 182 C200 184 182 180 168 172 Z" />
      <path className="br-plate" d="M176 122 C196 112 222 110 246 114 L240 122 C222 118 200 120 182 128 Z M188 134 C206 126 230 124 252 128 L246 136 C228 132 208 134 194 140 Z" />
      <path className="br-spike" d="M178 116 l4 -14 l7 12 Z M200 109 l5 -15 l7 13 Z M224 107 l5 -14 l6 13 Z M248 110 l5 -12 l5 11 Z" />
      <path className="br-fissure" d="M186 176 C204 182 230 182 254 176 M200 160 L212 166 L224 158 L238 166 M252 150 L262 142 L274 152" />

      {/* Patte proche */}
      {pose === "perch" ? (
        <g>
          <path className="br-body" d="M222 166 C238 170 248 186 242 206 L234 236 L250 248 L228 250 L216 246 L224 230 L220 206 C212 192 210 176 222 166 Z" />
          <path className="br-claw" d="M250 248 l8 2 l-6 3 Z M228 250 l7 3 l-7 2 Z M216 246 l-6 4 l7 1 Z" />
          <path className="br-fissure" d="M226 186 L234 196 L230 206" />
        </g>
      ) : (
        <g>
          <path className="br-body" d="M222 166 C238 170 246 182 238 194 L220 210 L206 216 L210 206 L224 194 C214 186 212 174 222 166 Z" />
          <path className="br-claw" d="M206 216 l-7 3 l3 -7 Z" />
        </g>
      )}

      {/* Cou et tête */}
      <path className="br-body" d="M268 120 C286 104 300 92 318 84 L334 94 C320 102 308 114 300 134 Z" />
      <path className="br-spike" d="M292 102 l-3 -11 l9 7 Z M306 92 l-2 -11 l9 7 Z" />
      <g className="br-head">
        <path className="br-horn" d="M330 75 C320 58 306 51 288 54 C302 60 314 68 322 81 Z" />
        <path className="br-horn" d="M341 72 C337 52 327 39 311 32 C322 45 330 58 332 76 Z" />
        <path className="br-horn br-horn-small" d="M352 72 C354 57 350 45 342 37 C344 51 345 61 345 74 Z" />
        <path className="br-body" d="M316 78 C330 70 350 69 366 75 L392 86 C397 88 397 92 392 94 L372 98 L389 104 C382 109 370 109 360 107 C346 105 330 100 318 94 C309 90 309 82 316 78 Z" />
        <path className="br-dark" d="M322 94 C312 102 300 104 290 102 C300 98 310 93 318 87 Z" />
        <path className="br-tooth" d="M372 98 l3 5 l3 -5 l3 5 l3 -5 l3 4 l2 -4 M362 106 l2 -4 l2 4 l2 -4 l2 4" />
        <path className="br-fissure" d="M330 84 L340 88 L352 86 M362 92 L372 90" />
        <circle className="br-eye-halo" cx="352" cy="82" r="11" fill={`url(#${uid}-eye)`} />
        <circle className="br-eye" cx="352" cy="82" r="3.2" />
        <g className="br-smoke">
          <circle cx="396" cy="88" r="3" />
          <circle cx="404" cy="82" r="4" />
          <circle cx="413" cy="74" r="5" />
        </g>
      </g>

      {/* Aile proche */}
      <Wing />

      {/* Braises qui s'échappent des fissures */}
      <g className="br-embers">
        {[
          [210, 168, 0],
          [246, 172, 0.7],
          [236, 150, 1.4],
          [96, 160, 0.4],
          [338, 86, 1.1],
          [268, 146, 1.8],
        ].map(([x, y, d], i) => (
          <circle key={i} cx={x} cy={y} r={1.6 + (i % 3) * 0.6} style={{ animationDelay: `${d}s` }} />
        ))}
      </g>
    </svg>
  );
}

/** Trois coups de griffe (pistes, farce). */
export function ClawMarks({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" className={`claw-marks ${className}`} style={style} aria-hidden>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className="claw-cut"
          d={`M${18 + i * 26} ${12 + i * 4} C${32 + i * 26} ${40 + i * 3} ${50 + i * 24} ${72 + i * 2} ${78 + i * 20} ${108 - i * 4} C${60 + i * 24} ${76 + i * 3} ${38 + i * 26} ${44 + i * 4} ${18 + i * 26} ${12 + i * 4} Z`}
          style={{ animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </svg>
  );
}

/** Empreinte à trois doigts griffus (les pistes à suivre). */
export function Track({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 60 64" className={`hunt-track ${className}`} style={style} aria-hidden>
      <path className="track-pad" d="M30 60 C18 60 12 52 14 42 C16 34 24 30 30 30 C36 30 44 34 46 42 C48 52 42 60 30 60 Z" />
      <path className="track-toe" d="M16 30 C10 24 8 16 10 10 C14 14 18 20 22 28 Z" />
      <path className="track-toe" d="M30 26 C27 18 27 9 30 2 C33 9 33 18 30 26 Z" />
      <path className="track-toe" d="M44 30 C50 24 52 16 50 10 C46 14 42 20 38 28 Z" />
      <circle className="track-glow" cx="30" cy="44" r="5" />
    </svg>
  );
}

/** Cor de chasse (pied de page). */
export function HuntHorn({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={`hunt-horn ${className}`} aria-hidden>
      <path className="horn-body" d="M4 22 C8 10 20 4 32 6 C36 7 38 10 36 13 C26 11 16 14 10 24 Z" />
      <path className="horn-bell" d="M30 4 C36 2 40 6 39 12 C38 16 34 16 32 14 C36 12 36 7 30 6 Z" />
      <path className="horn-band" d="M14 15 L17 19 M21 11 L23 15" />
      <path className="horn-mouth" d="M4 22 L1 26 L6 25 Z" />
      <path className="horn-cord" d="M8 20 C10 30 26 30 30 14" />
    </svg>
  );
}

/** Fanion de chasse (guirlande), avec ses trois griffes. */
export function Pennant({ variant = 0 }: { variant?: number }) {
  return (
    <g className={`pennant pennant-${variant % 3}`}>
      <path className="pennant-cloth" d="M-8 1 L8 1 L6 14 L0 22 L-6 14 Z" />
      <path className="pennant-mark" d="M-3 6 L-1 14 M0 5 L1 14 M3 6 L3 13" />
    </g>
  );
}

/** Dent ou croc suspendu (guirlande). */
export function Fang() {
  return <path className="pennant-fang" d="M-2 1 C-3 8 -1 14 0 18 C1 14 3 8 2 1 Z" />;
}
