import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card max-w-md space-y-4 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Erreur 404</p>
        <h1 className="font-display text-3xl uppercase tracking-wide">Dossier introuvable</h1>
        <p className="font-body text-paper/70">Cette page n&apos;existe pas, ou a été déplacée.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-lg border border-white/20 px-4 py-2 font-display text-sm uppercase hover:bg-white/10">
            Accueil
          </Link>
          <Link href="/dashboard" className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light">
            Tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}
