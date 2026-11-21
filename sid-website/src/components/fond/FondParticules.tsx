/**
 * Particules du fond (Lot 90) : de petites formes qui tombent (ou montent)
 * derrière la page. Forme, couleurs et sens viennent du thème (fonds.css).
 * Positions fixes : le rendu serveur et le navigateur donnent la même chose.
 */
const N = 24;

function suite(i: number) {
  const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
}

const ITEMS = Array.from({ length: N }, (_, i) => {
  const a = suite(i);
  const b = suite(i + 50);
  const c = suite(i + 100);
  return {
    left: `${(a * 100).toFixed(1)}%`,
    s: `${(9 + b * 12).toFixed(1)}px`,
    t: `${(14 + c * 12).toFixed(1)}s`,
    dl: `${(-suite(i + 150) * 26).toFixed(1)}s`,
    dx: `${Math.round((suite(i + 200) - 0.5) * 60)}px`,
    k: `var(--p${(i % 4) + 1})`,
  };
});

export function FondParticules() {
  return (
    <div className="fond-particules" aria-hidden>
      {ITEMS.map((it, i) => (
        <i
          key={i}
          style={{ left: it.left, "--s": it.s, "--t": it.t, "--dl": it.dl, "--dx": it.dx, "--k": it.k } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
