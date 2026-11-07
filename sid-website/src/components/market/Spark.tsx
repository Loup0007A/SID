/** Petite courbe (cote, indice) : bleue si la dernière valeur dépasse la première, rouge sinon. */
export function Spark({ values, width = 84, height = 24, className = "" }: { values: number[]; width?: number; height?: number; className?: string }) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return <span className={`inline-block font-mono text-[10px] text-paper/40 ${className}`} style={{ width }} aria-hidden>—</span>;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((x - lo) / span) * (height - 4)).toFixed(1)}`);
  const up = v[v.length - 1] >= v[0];
  const color = up ? "#BBD3EA" : "#D99A9A";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2" fill={color} />
    </svg>
  );
}
