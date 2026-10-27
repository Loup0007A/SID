"use client";

import { useRef, useState } from "react";
import { NETWORK_NODES } from "@/lib/titles";
import { SidIcon, SvgIcon } from "@/components/icons/SidIcon";

export type NetworkLogic = "fixe" | "rotation" | "aleatoire" | "echange";

export const LOGIC_LABELS: Record<NetworkLogic, { label: string; hint: string }> = {
  fixe: { label: "Fixe", hint: "Les liens restent branchés comme tu les as posés." },
  rotation: { label: "Rotation", hint: "Toutes les N secondes, chaque lien passe à la destination du suivant." },
  echange: { label: "Va-et-vient", hint: "Toutes les N secondes, les liens s'inversent : l'arrivée devient le départ." },
  aleatoire: { label: "Chaos", hint: "Chaque clic mène sur une page au hasard (tes liens sont ignorés)." },
};

const SIZE = 420;
const C = SIZE / 2;
const R = 160;
const NODE_R = 25;

function pos(i: number) {
  const a = (i / NETWORK_NODES.length) * Math.PI * 2 - Math.PI / 2;
  return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
}

/** Courbe entre deux nœuds, tirée vers le centre (les liens restent lisibles). */
function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const cx = mx + (C - mx) * 0.45, cy = my + (C - my) * 0.45;
  // On s'arrête au bord du nœud d'arrivée (pour la flèche).
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 1;
  const ex = b.x - (dx / d) * (NODE_R + 4), ey = b.y - (dy / d) * (NODE_R + 4);
  const sx0 = cx - a.x, sy0 = cy - a.y, sd = Math.hypot(sx0, sy0) || 1;
  const sx = a.x + (sx0 / sd) * NODE_R, sy = a.y + (sy0 / sd) * NODE_R;
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

/**
 * Éditeur de nœuds du Réseau détraqué : on glisse d'une page vers une autre
 * pour rebrancher le lien. Un nœud n'a qu'une sortie ; cliquer un lien l'efface.
 */
export function NodeEditor({
  map,
  onChange,
  logic,
  onLogic,
  every,
  onEvery,
}: {
  map: Record<string, string>;
  onChange: (m: Record<string, string>) => void;
  logic: NetworkLogic;
  onLogic: (l: NetworkLogic) => void;
  every: number;
  onEvery: (n: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  function toSvg(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  }
  function nodeAt(p: { x: number; y: number }) {
    let best = -1, bd = Infinity;
    NETWORK_NODES.forEach((_, i) => {
      const q = pos(i), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) { bd = d; best = i; }
    });
    return bd <= NODE_R + 14 ? best : -1;
  }

  function down(e: React.PointerEvent) {
    const p = toSvg(e);
    const i = nodeAt(p);
    if (i < 0) return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ from: i, ...p });
  }
  function move(e: React.PointerEvent) {
    const p = toSvg(e);
    setHover(nodeAt(p));
    if (drag) setDrag({ ...drag, ...p });
  }
  function up(e: React.PointerEvent) {
    if (!drag) return;
    const to = nodeAt(toSvg(e));
    const from = NETWORK_NODES[drag.from].href;
    if (to >= 0 && to !== drag.from) {
      onChange({ ...map, [from]: NETWORK_NODES[to].href });
    }
    setDrag(null);
  }

  function remove(from: string) {
    const next = { ...map };
    delete next[from];
    onChange(next);
  }

  function shuffle() {
    // Dérangement : aucune page ne pointe sur elle-même.
    const hrefs = NETWORK_NODES.map((n) => n.href);
    let perm = [...hrefs];
    for (let k = 0; k < 50; k++) {
      perm = [...hrefs].sort(() => Math.random() - 0.5);
      if (perm.every((h, i) => h !== hrefs[i])) break;
    }
    onChange(Object.fromEntries(hrefs.map((h, i) => [h, perm[i]])));
  }

  const idx = (href: string) => NETWORK_NODES.findIndex((n) => n.href === href);
  const links = Object.entries(map).filter(([a, b]) => idx(a) >= 0 && idx(b) >= 0);

  return (
    <div className="space-y-3">
      <div className="relative mx-auto w-full max-w-[420px] select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="node-editor w-full touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <marker id="ne-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#62d8ff" />
            </marker>
            <radialGradient id="ne-core" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#62d8ff" stopOpacity="0.25" />
              <stop offset="1" stopColor="#62d8ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r={R + 40} fill="url(#ne-core)" />
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(98,216,255,0.15)" strokeDasharray="3 6" />

          {links.map(([a, b]) => (
            <g key={a} className="ne-link" onPointerDown={(e) => { e.stopPropagation(); remove(a); }}>
              <path d={curve(pos(idx(a)), pos(idx(b)))} className="ne-link-hit" />
              <path d={curve(pos(idx(a)), pos(idx(b)))} className="ne-link-line" markerEnd="url(#ne-arrow)" />
            </g>
          ))}

          {drag && <line x1={pos(drag.from).x} y1={pos(drag.from).y} x2={drag.x} y2={drag.y} className="ne-drag" />}

          {NETWORK_NODES.map((n, i) => {
            const p = pos(i);
            const out = map[n.href];
            return (
              <g key={n.href} transform={`translate(${p.x} ${p.y})`} className={`ne-node ${hover === i ? "is-hover" : ""} ${out ? "is-linked" : ""} ${drag?.from === i ? "is-source" : ""}`}>
                <circle r={NODE_R} />
                <SvgIcon name={n.icon} size={24} />
                <text y={NODE_R + 14} textAnchor="middle" className="ne-label">{n.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-center font-mono text-[11px] text-paper/65">
        Glisse d&apos;une page vers une autre. Quand ta cible cliquera sur un lien vers la première, elle arrivera sur la
        seconde. Touche un lien pour l&apos;effacer.
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={shuffle} className="rounded-lg border border-blue/60 px-3 py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink">
          <SidIcon name="dice" /> Tout mélanger
        </button>
        <button type="button" onClick={() => onChange({})} className="rounded-lg border border-white/20 px-3 py-1 font-mono text-xs uppercase text-paper/70 hover:bg-white/10">
          Effacer
        </button>
        <span className="self-center font-mono text-[11px] text-paper/65">{links.length} lien{links.length > 1 ? "s" : ""} rebranché{links.length > 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="font-mono text-xs uppercase tracking-wide text-paper/60">Logique de changement</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LOGIC_LABELS) as NetworkLogic[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLogic(l)}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${logic === l ? "border-[#62d8ff] bg-[#62d8ff] text-ink" : "border-white/20 text-paper/70 hover:bg-white/10"}`}
            >
              {LOGIC_LABELS[l].label}
            </button>
          ))}
        </div>
        <p className="font-body text-xs text-paper/60">{LOGIC_LABELS[logic].hint}</p>
        {(logic === "rotation" || logic === "echange") && (
          <label className="flex items-center gap-3 font-mono text-xs text-paper/70">
            Toutes les
            <input type="range" min={10} max={120} step={5} value={every} onChange={(e) => onEvery(Number(e.target.value))} className="flex-1 accent-[#62d8ff]" />
            <span className="w-12 text-right">{every} s</span>
          </label>
        )}
      </div>
    </div>
  );
}
