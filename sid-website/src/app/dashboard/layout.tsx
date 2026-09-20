"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { Profile, PermissionKey } from "@/types/database";
import { NotificationBell } from "@/components/NotificationBell";
import { registerServiceWorker } from "@/lib/push";

const NAV: { href: string; label: string; perm?: PermissionKey[] }[] = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/org-chart", label: "Organigramme" },
  { href: "/dashboard/members", label: "Trombinoscope" },
  { href: "/dashboard/quests", label: "Quêtes" },
  { href: "/dashboard/shop", label: "Boutique" },
  { href: "/dashboard/leaderboard", label: "Classement" },
  { href: "/dashboard/map", label: "Carte" },
  { href: "/dashboard/bank", label: "Banque" },
  { href: "/dashboard/business", label: "Entreprise", perm: ["entreprise"] },
  { href: "/dashboard/chat", label: "Messagerie" },
  { href: "/dashboard/profile", label: "Mon dossier" },
  { href: "/dashboard/admin/applications", label: "Recrutement", perm: ["recruit"] },
  { href: "/dashboard/admin/roles", label: "Rôles & équipes", perm: ["manage_roles", "manage_teams", "manage_users"] },
  { href: "/dashboard/admin/economy", label: "Économie", perm: ["manage_economy"] },
  { href: "/dashboard/admin/users", label: "Administration", perm: ["manage_users"] },
  { href: "/dashboard/admin/stats", label: "Statistiques", perm: ["manage_users"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      const { profile, permissions } = await loadCurrentUser();
      setProfile(profile);
      setPermissions(permissions);
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  return (
    <div className="flex min-h-screen text-paper">
      <aside className="grain-panel hidden w-64 shrink-0 flex-col border-r border-ink-border p-5 md:flex">
        <div className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo S.I.D." className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl uppercase tracking-wide text-red">S.I.D.</p>
            <p className="truncate font-mono text-xs text-paper/50">{profile?.nickname}</p>
            {profile?.is_founder && <span className="stamp mt-1 text-red">Fondateur</span>}
          </div>
          {profile && <NotificationBell userId={profile.id} />}
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.filter((item) => !item.perm || can(permissions, ...item.perm)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "block rounded-lg px-3 py-2 font-mono text-sm uppercase tracking-wide hover:bg-ink-border",
                pathname === item.href && "bg-ink-border text-blue-light"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="rounded-lg mt-4 border border-paper/20 px-3 py-2 font-mono text-xs uppercase text-paper/70 hover:border-red hover:text-red"
        >
          Se déconnecter
        </button>
      </aside>

      <div className="flex-1">
        <div className="glass-panel sticky top-0 z-20 pt-[env(safe-area-inset-top)] md:hidden">
          <div className="flex items-center gap-2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo S.I.D." className="h-8 w-8 rounded-full" />
            <p className="font-display text-xl uppercase text-red">S.I.D.</p>
            <div className="ml-auto flex items-center gap-2">
              {profile && <NotificationBell userId={profile.id} />}
              <button
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Ouvrir le menu"
                aria-expanded={mobileMenuOpen}
                className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5"
              >
                <span
                  className={clsx(
                    "h-0.5 w-5 bg-paper transition-transform",
                    mobileMenuOpen && "translate-y-2 rotate-45"
                  )}
                />
                <span className={clsx("h-0.5 w-5 bg-paper transition-opacity", mobileMenuOpen && "opacity-0")} />
                <span
                  className={clsx(
                    "h-0.5 w-5 bg-paper transition-transform",
                    mobileMenuOpen && "-translate-y-2 -rotate-45"
                  )}
                />
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="space-y-1 border-t border-white/10 px-4 pb-4">
              <p className="pt-3 font-mono text-xs text-paper/50">{profile?.nickname}</p>
              {profile?.is_founder && <span className="stamp mb-2 mt-1 inline-block text-red">Fondateur</span>}
              {NAV.filter((item) => !item.perm || can(permissions, ...item.perm)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "block rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wide hover:bg-white/10",
                    pathname === item.href && "bg-white/10 text-blue-light"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="mt-2 w-full rounded-lg border border-paper/20 px-3 py-2.5 text-left font-mono text-xs uppercase text-paper/70 hover:border-red hover:text-red"
              >
                Se déconnecter
              </button>
            </nav>
          )}
        </div>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
