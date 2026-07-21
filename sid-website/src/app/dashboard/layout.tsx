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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-ink text-paper">Ouverture du dossier…</div>;
  }

  if (profile && profile.status === "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4">
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
      <main className="flex min-h-screen items-center justify-center bg-ink px-4">
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
    <div className="flex min-h-screen bg-ink text-paper">
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
        <div className="glass-panel sticky top-0 z-10 flex items-center gap-2 p-4 md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo S.I.D." className="h-8 w-8 rounded-full" />
          <p className="font-display text-xl uppercase text-red">S.I.D.</p>
        </div>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
