import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

/** Mise en page des pages publiques (CGU, confidentialité) : lisibles sans être connecté. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen text-paper">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="Retour au S.I.D.">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full" />
            <span className="font-display text-xl uppercase tracking-wide text-red">S.I.D.</span>
          </Link>
          <span className="truncate font-display uppercase tracking-wide text-paper/80">{title}</span>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 font-display text-3xl uppercase tracking-wide text-red">{title}</h1>
        <div className="glass-card p-5 sm:p-8">{children}</div>
      </article>
      <SiteFooter />
    </main>
  );
}
