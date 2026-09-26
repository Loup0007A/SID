import Link from "next/link";

/** Lien vers /dashboard/settings, même gabarit que NotificationBell (bouton rond, icône seule). */
export function SettingsButton() {
  return (
    <Link
      href="/dashboard/settings"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-paper hover:bg-white/10"
      aria-label="Réglages"
      title="Réglages"
    >
      ⚙️
    </Link>
  );
}
