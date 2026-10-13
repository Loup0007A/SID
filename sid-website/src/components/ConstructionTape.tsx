/**
 * Bandeau de chantier jaune et noir « En développement ».
 *  - "ribbon" : bande en diagonale posée par-dessus une tuile (le parent
 *    doit être en `relative overflow-hidden`) ;
 *  - "banner" : bandeau pleine largeur en haut d'une page.
 */
export function ConstructionTape({
  variant = "ribbon",
  label = "En développement",
}: {
  variant?: "ribbon" | "banner";
  label?: string;
}) {
  if (variant === "banner") {
    return (
      <div className="construction-tape flex items-center justify-center rounded-lg px-3 py-3" role="note">
        <span className="construction-tape-label text-xs sm:text-sm">🚧 {label}</span>
      </div>
    );
  }

  return (
    <span
      aria-hidden
      className="construction-tape pointer-events-none absolute left-[-15%] right-[-15%] top-[17%] flex -rotate-[8deg] items-center justify-center py-1.5"
    >
      <span className="construction-tape-label text-[10px]">{label}</span>
    </span>
  );
}
