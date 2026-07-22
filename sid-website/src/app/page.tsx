import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuestCard } from "@/components/QuestCard";
import type { Quest } from "@/types/database";

export const revalidate = 30;

export default async function HomePage() {
  const supabase = createClient();
  const { data: quests } = await supabase
    .from("quests")
    .select("*")
    .eq("visibility", "public")
    .in("status", ["open", "in_progress"])
    .order("deadline", { ascending: true, nullsFirst: false });

  const openCount = quests?.length ?? 0;

  return (
    <main className="min-h-screen text-paper">
      <header className="glass-panel sticky top-0 z-10 border-b-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo S.I.D."
              className="h-16 w-16 shrink-0 rounded-full ring-2 ring-white/15 sm:h-20 sm:w-20 md:h-24 md:w-24"
            />
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Dossier public — accès libre</p>
              <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">S.I.D.</h1>
              <p className="mt-2 max-w-xl font-body text-paper/75">
                Section d&apos;Intervention Discrète. Voici les missions ouvertes à connaissance publique.
                Rejoignez nos rangs pour accéder au reste du dossier.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-center font-display uppercase tracking-wide text-paper backdrop-blur-sm hover:bg-white/15"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-red px-5 py-2.5 text-center font-display uppercase tracking-wide text-ink shadow-lg shadow-red/20 hover:bg-red-light"
            >
              Candidater
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl uppercase tracking-wide text-red">Panneau des missions</h2>
          <span className="glass-panel rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-blue-light">
            {openCount} mission{openCount !== 1 ? "s" : ""} ouverte{openCount !== 1 ? "s" : ""}
          </span>
        </div>

        {!quests || quests.length === 0 ? (
          <p className="grain-panel rounded-xl p-8 text-center font-body text-paper/60">
            Aucune mission n&apos;est actuellement affichée au public. Revenez plus tard.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(quests as Quest[]).map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </div>
        )}
      </section>

      <footer className="glass-panel border-t-0 px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center font-mono text-xs text-paper/50 sm:px-6">
        S.I.D. — Accès restreint au-delà de cette page.
      </footer>
    </main>
  );
}
