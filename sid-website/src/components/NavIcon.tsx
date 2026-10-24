import type { NavEntry } from "@/lib/navigation";
import { SidIcon } from "@/components/icons/SidIcon";

/** Icône d'une page (icônes S.I.D., voir src/components/icons/sidIcons.tsx). */
export function NavIcon({ entry, size = 56 }: { entry: NavEntry; size?: number }) {
  return <SidIcon name={entry.icon} size={size} className="nav-icon" />;
}
