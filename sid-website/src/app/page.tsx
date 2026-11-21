import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { QuestCard } from "@/components/QuestCard";
import type { Quest } from "@/types/database";
import { getBrand } from "@/lib/brand-server";

// Page publique, identique pour tout le monde : préparée à l'avance et
// servie par le CDN, puis remise à jour toutes les 30 s au plus.
export const revalidate = 30;

export default async function HomePage() {
  // Composant serveur : rendu en parallèle de la mise en page, il attend lui-même les noms (Lot 77).
  await getBrand();
  const supabase = createPublicClient();
  const { data: quests } = await supabase
    .from("quests")
    .select("*")
    .eq("visibility", "public")
    .in("status", ["open", "in_progress"])
    .order("deadline", { ascending: true, nullsFirst: false });

  const openCount = quests?.length ?? 0;

  return (
    <main className="min-h-screen text-paper">
      {/* Refonte (Lot 90) : le titre posé sur le fond, façon autocollant. */}
      <header className="mx-auto max-w-6xl px-4 pb-4 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6 sm:pt-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.webp" width={112} height={112} decoding="async"
              alt="Logo S.I.D."
              className="sceau-logo h-20 w-20 shrink-0 rounded-full sm:h-28 sm:w-28"
            />
            <div>
              <p className="etiquette-collee">Dossier public · accès libre</p>
              <h1 className="titre-sticker mt-2 text-6xl sm:text-8xl">S.I.D.</h1>
            </div>
          </div>
          {/* Pas de préchargement (Lot 65, PageSpeed) : ces deux pages
              embarquent le client Supabase (~50 Kio), chargé sinon dès
              l'accueil pour rien. Elles s'ouvrent au clic. */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              prefetch={false}
              className="rounded-xl bg-paper px-5 py-2.5 text-center font-display uppercase tracking-wide text-ink"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              prefetch={false}
              className="rounded-xl bg-red px-5 py-2.5 text-center font-display uppercase tracking-wide text-ink"
            >
              Candidater
            </Link>
          </div>
        </div>
        <p className="glass-card mt-8 max-w-2xl p-5 font-body text-lg leading-snug">
          Système International Dictatorial. Voici les missions ouvertes à connaissance publique.
          Rejoignez nos rangs pour accéder au reste du dossier.
        </p>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="titre-sticker text-3xl sm:text-4xl">Panneau des missions</h2>
          <span className="glass-panel rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wide shadow-dur-sm">
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

      <footer className="px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center font-mono text-xs text-paper/80 sm:px-6">
        S.I.D. — Accès restreint au-delà de cette page.
      </footer>
    </main>
  );
}
