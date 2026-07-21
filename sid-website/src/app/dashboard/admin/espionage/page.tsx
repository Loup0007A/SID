"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, SpyRole, SpyReport } from "@/types/database";


export default function EspionageAdminPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Profile[]>([]);
  const [spies, setSpies] = useState<Map<string, SpyRole>>(new Map());
  const [reports, setReports] = useState<SpyReport[]>([]);
  const [profilesById, setProfilesById] = useState<Map<string, Profile>>(new Map());

  async function refresh() {
    const [{ data: m }, { data: s }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("status", "active").order("nickname"),
      supabase.from("spy_roles").select("*"),
      supabase.from("spy_reports").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setMembers(m ?? []);
    setProfilesById(new Map((m ?? []).map((p) => [p.id, p])));
    setSpies(new Map((s ?? []).map((x) => [x.user_id, x])));
    setReports(r ?? []);
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleSpy(userId: string, makeSpy: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (makeSpy) {
      await supabase.from("spy_roles").insert({ user_id: userId, assigned_by: user?.id });
    } else {
      await supabase.from("spy_roles").delete().eq("user_id", userId);
    }
    refresh();
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Accès restreint</p>
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Gestion du réseau d&apos;espionnage</h1>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase text-paper">Attribution du rôle</h2>
        <div className="space-y-2">
          {members.map((m) => {
            const spy = spies.get(m.id);
            return (
              <div key={m.id} className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-body">{m.nickname}</span>
                {spy ? (
                  <span className="font-mono text-xs text-red">
                    Espion · niveau {spy.spy_level} · {spy.xp} XP
                  </span>
                ) : (
                  <span className="font-mono text-xs text-paper/50">—</span>
                )}
                <button
                  onClick={() => toggleSpy(m.id, !spy)}
                  className={`border px-3 py-1 font-mono text-xs uppercase ${
                    spy ? "border-red text-red hover:bg-red hover:text-ink" : "border-blue text-blue hover:bg-blue hover:text-ink"
                  }`}
                >
                  {spy ? "Retirer" : "Nommer espion"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase text-paper">Derniers rapports (supervision anti-abus)</h2>
        {reports.length === 0 && <p className="font-body text-paper/60">Aucun rapport pour l&apos;instant.</p>}
        {reports.map((r) => (
          <div key={r.id} className="glass-card space-y-1 p-4">
            <p className="font-mono text-xs text-paper/60">
              {profilesById.get(r.spy_id)?.nickname ?? "Espion inconnu"} — {new Date(r.created_at).toLocaleString("fr-FR")}
            </p>
            {r.snippets.map((s, i) => (
              <p key={i} className="font-body text-sm">
                <span className="font-mono text-xs uppercase text-red">{s.sender_nickname} : </span>
                {s.content}
              </p>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
