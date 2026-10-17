import Link from "next/link";
import { SidWord } from "@/components/secrets/SidWord";

/** Pied de page : liens légaux et données personnelles, sur toutes les pages. */
export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-10 sm:px-6">
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 font-mono text-[11px] uppercase tracking-wide text-paper/45">
        <SidWord />
        <Link href="/cgu" className="hover:text-paper hover:underline">Conditions d&apos;utilisation</Link>
        <Link href="/confidentialite" className="hover:text-paper hover:underline">Confidentialité</Link>
        <Link href="/dashboard/privacy" className="hover:text-paper hover:underline">Mes données</Link>
      </nav>
    </footer>
  );
}
