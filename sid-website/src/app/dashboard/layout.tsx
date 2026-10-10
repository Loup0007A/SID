"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser } from "@/lib/permissions";
import type { Profile } from "@/types/database";
import { NotificationBell } from "@/components/NotificationBell";
import { SettingsButton } from "@/components/SettingsButton";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { ScrollMemory } from "@/components/ScrollMemory";
import { entryForPath } from "@/lib/navigation";
import { registerServiceWorker } from "@/lib/push";

/** Titre affiché dans la barre du haut pour la page en cours. */
function pageTitle(pathname: string): string | null {
  if (pathname === "/dashboard") return null;
  if (pathname.startsWith("/dashboard/profile/")) return "Dossier d'un membre";
  return entryForPath(pathname)?.label ?? null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Enregistre le service worker dès l'arrivée sur le dashboard (pas
    // besoin d'attendre que le membre active le push) : c'est aussi une
    // condition pour qu'iOS propose "Ajouter à l'écran d'accueil".
    registerServiceWorker();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { profile } = await loadCurrentUser();
      setProfile(profile);
      setLoading(false);

      // Traite l'économie du jour pour TOUT LE MONDE (pas seulement soi) :
      // salaires en retard, intérêts bancaires, intérêts de dette. Se
      // déclenche à la connexion de n'importe quel membre — pas de
      // dépendance à pg_cron.
      try {
        await supabase.rpc("process_daily_economy");
      } catch {
        // silencieux
      }

      // Fait avancer un trajet en cours (intégration carte / sid-map) —
      // couvre le cas où l'utilisateur navigue sans repasser par la page
      // Carte ou Quêtes.
      try {
        await supabase.rpc("advance_my_travel");
      } catch {
        // silencieux : ne s'applique que si character_positions existe
      }

      // Enregistre la visite du jour (pour les statistiques admin : membres
      // actifs aujourd'hui, visites, heure la plus active…).
      try {
        await supabase.rpc("record_visit");
      } catch {
        // silencieux
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-paper">Ouverture du dossier…</div>;
  }

  if (profile && profile.status === "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card max-w-md space-y-3 p-8 text-center">
          <h1 className="font-display text-2xl uppercase">Candidature en attente</h1>
          <p className="font-body">
            Ton dossier est en cours d&apos;examen par les officiers recruteurs. Tu pourras suivre
            leur réponse ici même une fois traité.
          </p>
          <button onClick={handleLogout} className="font-mono text-xs uppercase text-red underline">
            Se déconnecter
          </button>
        </div>
      </main>
    );
  }

  if (profile && profile.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card max-w-md space-y-3 p-8 text-center">
          <h1 className="font-display text-2xl uppercase">Accès refusé</h1>
          <p className="font-body">Ce dossier n&apos;a pas (ou plus) accès à la plateforme.</p>
          <button onClick={handleLogout} className="font-mono text-xs uppercase text-red underline">
            Se déconnecter
          </button>
        </div>
      </main>
    );
  }

  const isHome = pathname === "/dashboard";
  const title = pageTitle(pathname);

  return (
    <div className="min-h-screen text-paper">
      <ScrollMemory />
      {profile && <AnnouncementBanner />}

      <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" scroll={false} className="flex shrink-0 items-center gap-2" aria-label="Accueil du S.I.D.">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full" />
            <span className="hidden font-display text-xl uppercase tracking-wide text-red sm:inline">S.I.D.</span>
          </Link>

          {!isHome && (
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/dashboard"
                scroll={false}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs uppercase tracking-wide hover:bg-white/10"
              >
                ← Accueil
              </Link>
              {title && <span className="truncate font-display uppercase tracking-wide text-paper/80">{title}</span>}
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {profile && (
              <span className="hidden items-center gap-2 md:flex">
                <span className="max-w-[10rem] truncate font-mono text-xs text-paper/60">{profile.nickname}</span>
                {profile.is_founder && <span className="stamp text-red">Fondateur</span>}
              </span>
            )}
            {profile && <NotificationBell userId={profile.id} />}
            <SettingsButton />
            <button
              onClick={handleLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-2.5 font-mono text-xs uppercase text-paper/70 hover:border-red hover:text-red"
            >
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden" aria-hidden>
                ⏻
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
