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

  return (
    <main className="min-h-screen bg-ink text-paper">
      <header className="border-b border-ink-border bg-ink-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo S.I.D." className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Dossier public — accès libre</p>
              <h1 className="font-display text-5xl uppercase tracking-wide">S.I.D.</h1>
              <p className="mt-2 max-w-xl font-body text-paper/70">
                Système Dictatorial S.I.D. Voici les missions ouvertes à connaissance publique.
                Rejoignez nos rangs pour accéder au reste du dossier.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-paper/40 px-5 py-2 font-display uppercase tracking-wide text-paper hover:bg-paper hover:text-ink"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-red px-5 py-2 font-display uppercase tracking-wide text-ink hover:bg-red-light"
            >
              Candidater
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 font-display text-2xl uppercase tracking-wide text-red">
          Panneau des missions
        </h2>

        {!quests || quests.length === 0 ? (
          <p className="grain-panel rounded p-6 text-center font-body text-paper/60">
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

      <footer className="border-t border-ink-border px-6 py-8 text-center font-mono text-xs text-paper/40">
        S.I.D. — Accès restreint au-delà de cette page.
      </footer>
    </main>
  );
}
