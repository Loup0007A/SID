"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { Profile, PermissionKey } from "@/types/database";

const NAV: { href: string; label: string; perm?: PermissionKey[] }[] = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/org-chart", label: "Organigramme" },
  { href: "/dashboard/members", label: "Trombinoscope" },
  { href: "/dashboard/quests", label: "Quêtes" },
  { href: "/dashboard/shop", label: "Boutique" },
  { href: "/dashboard/chat", label: "Messagerie" },
  { href: "/dashboard/profile", label: "Mon dossier" },
  { href: "/dashboard/admin/applications", label: "Recrutement", perm: ["recruit"] },
  { href: "/dashboard/admin/roles", label: "Rôles & équipes", perm: ["manage_roles", "manage_teams", "manage_users"] },
  { href: "/dashboard/admin/economy", label: "Économie", perm: ["manage_economy"] },
  { href: "/dashboard/admin/espionage", label: "Espionnage (admin)", perm: ["manage_espionage"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [isSpy, setIsSpy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
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

      const { data: spyRow } = await supabase.from("spy_roles").select("user_id").eq("user_id", user.id).maybeSingle();
      setIsSpy(!!spyRow);

      setLoading(false);
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
          <div>
            <p className="font-display text-2xl uppercase tracking-wide text-red">S.I.D.</p>
            <p className="font-mono text-xs text-paper/50">{profile?.nickname}</p>
            {profile?.is_founder && <span className="stamp mt-1 text-red">Fondateur</span>}
          </div>
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
          {isSpy && (
            <Link
              href="/dashboard/spy"
              className={clsx(
                "block rounded-lg px-3 py-2 font-mono text-sm uppercase tracking-wide text-red hover:bg-ink-border",
                pathname === "/dashboard/spy" && "bg-ink-border"
              )}
            >
              🕵 Réseau
            </Link>
          )}
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
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Ouvrir le menu"
              aria-expanded={mobileMenuOpen}
              className="ml-auto flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5"
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
              {isSpy && (
                <Link
                  href="/dashboard/spy"
                  className="block rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-red hover:bg-white/10"
                >
                  🕵 Réseau
                </Link>
              )}
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
