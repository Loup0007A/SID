"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/session";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { PermissionKey, Profile } from "@/types/database";
import { NotificationBell } from "@/components/NotificationBell";
import { SettingsButton } from "@/components/SettingsButton";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { ScrollMemory } from "@/components/ScrollMemory";
import { entryForPath } from "@/lib/navigation";
import { SectionGate } from "@/components/SectionGate";
import { registerServiceWorker } from "@/lib/push";
import { SandboxBanner } from "@/components/SandboxBanner";
import { leaveSandbox } from "@/lib/sandbox";
import { TermsBanner } from "@/components/TermsBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { TrollLayer } from "@/components/trolls/TrollLayer";
import { SeasonalGarland, anyHoliday } from "@/components/seasonal/Seasonal";
import { useSiteDecor } from "@/components/seasonal/siteDecor";
import { AfterIdle } from "@/components/lazy/AfterIdle";
import { Sceau1, Sceau2, Sceau7, Sceau8, Sceau9 } from "@/components/lazy/Seals";

// Pas urgents : téléchargés une fois la page affichée.
const TitleUnlock = dynamic(() => import("@/components/titles/TitleUnlock").then((m) => m.TitleUnlock), { ssr: false });
const PresenceTracker = dynamic(() => import("@/components/presence/PresenceTracker").then((m) => m.PresenceTracker), { ssr: false });

/**
 * Le profil (et les permissions) du dernier passage, gardé dans le navigateur
 * pour afficher le tableau de bord tout de suite à l'ouverture suivante ; la
 * version à jour arrive juste après et remplace celle-ci.
 */
type MeSnapshot = { profile: Profile; perms: PermissionKey[] };
const ME_KEY = "sid-me-v1";

function readSnapshot(uid: string): MeSnapshot | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as MeSnapshot;
    return snap.profile?.id === uid ? snap : null;
  } catch {
    return null;
  }
}

function writeSnapshot(profile: Profile | null, perms: Set<PermissionKey>) {
  try {
    // Seulement pour un compte actif et hors bac à sable : sinon, on attend toujours la version à jour.
    if (profile && profile.status === "active" && !profile.sandbox_expires_at) localStorage.setItem(ME_KEY, JSON.stringify({ profile, perms: Array.from(perms) }));
    else localStorage.removeItem(ME_KEY);
  } catch {
    /* stockage indisponible : pas de raccourci, rien de grave */
  }
}

/** Au plus une fois par `ms` dans ce navigateur. */
function due(key: string, ms: number) {
  try {
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < ms) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* sans stockage : on fait comme avant, à chaque ouverture */
  }
  return true;
}

/** Titre affiché dans la barre du haut pour la page en cours. */
function pageTitle(pathname: string): string | null {
  if (pathname === "/dashboard") return null;
  if (pathname.startsWith("/dashboard/profile/")) return "Dossier d'un membre";
  if (pathname.startsWith("/dashboard/admin/members/")) return "Fiche d'un membre";
  return entryForPath(pathname)?.label ?? null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Profil confirmé par la base (et pas seulement repris du dernier passage).
  const [fresh, setFresh] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [perms, setPerms] = useState<Set<PermissionKey>>(new Set());
  const [openAlerts, setOpenAlerts] = useState(0);
  const decor = useSiteDecor();

  useEffect(() => {
    // Enregistre le service worker dès l'arrivée sur le dashboard (pas
    // besoin d'attendre que le membre active le push) : c'est aussi une
    // condition pour qu'iOS propose "Ajouter à l'écran d'accueil".
    registerServiceWorker();

    let alive = true;
    (async () => {
      // Session lue sur place : pas d'aller-retour réseau.
      const uid = await currentUserId();
      if (!uid) {
        router.replace("/login");
        return;
      }

      // Affichage immédiat avec le profil du dernier passage, s'il y en a un.
      const snap = readSnapshot(uid);
      if (snap && alive) {
        const p = new Set(snap.perms);
        setProfile(snap.profile);
        setPerms(p);
        setIsStaff(can(p, "manage_users"));
        setLoading(false);
      }

      const { profile, permissions } = await loadCurrentUser();
      if (!alive) return;
      if (!profile) {
        try {
          localStorage.removeItem(ME_KEY);
        } catch {}
        router.replace("/login");
        return;
      }
      setProfile(profile);
      setPerms(permissions);
      setIsStaff(can(permissions, "manage_users"));
      setFresh(true);
      setLoading(false);
      writeSnapshot(profile, permissions);

      // Entretien, une fois la page et ses données arrivées (rien de tout
      // ceci n'est affiché) : en parallèle, et pas à chaque ouverture.
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const later = (cb: () => void) => (idle ? idle(cb, { timeout: 3000 }) : setTimeout(cb, 1200));
      later(async () => {
        const jobs: PromiseLike<unknown>[] = [
          // Fait avancer un trajet en cours (intégration carte / sid-map).
          supabase.rpc("advance_my_travel"),
          // Visite du jour (statistiques admin : membres actifs, visites…).
          supabase.rpc("record_visit"),
        ];
        // Économie du jour pour TOUT LE MONDE (salaires en retard, intérêts,
        // marché) : rattrape le temps écoulé, donc inutile à chaque page.
        if (due("sid-run-economy", 5 * 60_000)) jobs.push(supabase.rpc("process_daily_economy"));
        // Détecteur d'activité inhabituelle (la base ne le relance pas plus d'une fois toutes les 3 min).
        if (due("sid-run-scan", 3 * 60_000)) jobs.push(supabase.rpc("maybe_scan_activity_alerts"));
        if (can(permissions, "manage_users") && !profile.sandbox_expires_at) {
          jobs.push(
            supabase.rpc("count_open_alerts").then(({ data: n }) => {
              if (alive) setOpenAlerts(Number(n) || 0);
            }),
          );
        }
        // Silencieux : certaines fonctions n'existent que si leur migration a été lancée.
        await Promise.allSettled(jobs);
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Titre de l'onglet : la page en cours (pratique avec plusieurs onglets et
  // dans l'historique du navigateur).
  useEffect(() => {
    const t = pageTitle(pathname);
    document.title = t ? `${t} · S.I.D.` : "S.I.D. — Dossier Central";
  }, [pathname]);

  async function handleLogout() {
    try {
      await supabase.rpc("presence_leave");
    } catch {
      // silencieux
    }
    try {
      localStorage.removeItem(ME_KEY);
    } catch {}
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Pendant que le profil arrive (première ouverture seulement), la page est
  // déjà montée mais invisible : elle charge ses propres données en même
  // temps, au lieu d'attendre le profil pour commencer.
  const booting = loading;

  // Compte de test (bac à sable) expiré : plus d'accès, retour au compte d'admin.
  if (profile?.sandbox_expires_at && new Date(profile.sandbox_expires_at).getTime() <= Date.now()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card max-w-md space-y-3 p-8 text-center">
          <h1 className="font-display text-2xl uppercase">Compte de test expiré</h1>
          <p className="font-body">
            Ce compte du bac à sable a expiré. Il sera effacé, avec tout ce qu&apos;il a créé, à la prochaine visite
            d&apos;un admin sur la page Bac à sable.
          </p>
          <button onClick={() => leaveSandbox()} className="font-mono text-xs uppercase text-red underline">
            Revenir à mon compte
          </button>
        </div>
      </main>
    );
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
    <>
    <div id="sid-app" className="min-h-screen text-paper">
      <ScrollMemory />
      {profile?.sandbox_expires_at && <SandboxBanner nickname={profile.nickname} expiresAt={profile.sandbox_expires_at} permissions={perms} />}
      {fresh && profile && !profile.sandbox_expires_at && <TermsBanner acceptedVersion={profile.terms_version} />}
      {profile && <AnnouncementBanner />}

      <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <SeasonalGarland />
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" scroll={false} className="flex shrink-0 items-center gap-2" aria-label="Accueil du S.I.D.">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" width={36} height={36} decoding="async" alt="" className="h-9 w-9 rounded-full" />
            <span className="sid-wordmark hidden font-display text-xl uppercase tracking-wide text-red sm:inline">S.I.D.</span>
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
            {openAlerts > 0 && (
              <Link
                href="/dashboard/admin/alerts"
                scroll={false}
                title={`${openAlerts} alerte${openAlerts > 1 ? "s" : ""} d'activité à traiter`}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-red/60 bg-red/15 px-2.5 font-mono text-xs text-red hover:bg-red hover:text-ink"
              >
                ⚠️ {openAlerts}
              </Link>
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

      <main className="relative mx-auto max-w-6xl p-4 sm:p-6">
        {booting && (
          <p className="pointer-events-none absolute inset-x-0 top-24 text-center text-paper" role="status">
            Ouverture du dossier…
          </p>
        )}
        <div style={booting ? { visibility: "hidden" } : undefined} aria-busy={booting || undefined}>
          <SectionGate section={entryForPath(pathname)?.section} bypass={isStaff}>
            {children}
          </SectionGate>
        </div>
        {profile && fresh && (
          <AfterIdle>
            <Sceau2 />
          </AfterIdle>
        )}
      </main>
      <SiteFooter />
    </div>
    {profile && <TrollLayer nickname={profile.nickname} />}
    {profile && fresh && <PresenceTracker />}
    {profile && fresh && (
      <AfterIdle>
        <TitleUnlock userId={profile.id} equipped={profile.equipped_title ?? null} />
        <Sceau1 />
        {decor?.halloween && <Sceau7 />}
        {decor?.noel && <Sceau8 />}
        {anyHoliday(decor) && <Sceau9 />}
      </AfterIdle>
    )}
    </>
  );
}
