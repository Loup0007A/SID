"use client";

import { useCallback, useEffect, useState } from "react";
import { sourceObtention } from "@/lib/cachet";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { POWERS, TITLES, TITLE_BY_ID, isTitleId, roman, type TitleId, type TrollPower } from "@/lib/titles";
import { inputClass } from "@/lib/ui";
import { SidIcon } from "@/components/icons/SidIcon";

type Overview = {
  enabled: boolean;
  holders: { user_id: string; nickname: string; title_id: string; level: number; source: string | null; obtained_at: string; equipped: boolean }[];
  trolls: { id: number; power: TrollPower; actor: string; target: string; created_at: string; ends_at: string; cancelled: boolean; active: boolean }[];
  shields: { user_id: string; nickname: string; reason: string | null; created_at: string }[];
};


export default function AdminTitlesPage() {
  const supabase = createClient();
  const [data, setData] = useState<Overview | null>(null);
  const [members, setMembers] = useState<{ id: string; nickname: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [grantUser, setGrantUser] = useState("");
  const [grantTitle, setGrantTitle] = useState<TitleId>("dragon");
  const [shieldUser, setShieldUser] = useState("");
  const [shieldReason, setShieldReason] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_titles_overview");
    if (error) {
      setError(error.message.includes("admin_titles_overview") ? "La migration 0061 doit être lancée." : error.message);
      return;
    }
    setData(data as Overview);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.rpc("list_roster").then(({ data }) => setMembers(((data ?? []) as { id: string; nickname: string }[]).filter(Boolean)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setMsg(null);
    const { error } = await fn();
    setMsg(error ? `Échec : ${error.message}` : ok);
    load();
  }

  if (error) return <p className="font-body text-paper/70">{error}</p>;
  if (!data) return <p className="font-body text-paper/60">Chargement…</p>;

  const byTitle = new Map<string, Overview["holders"]>();
  data.holders.forEach((h) => byTitle.set(h.title_id, [...(byTitle.get(h.title_id) ?? []), h]));
  const active = data.trolls.filter((t) => t.active);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Titres et farces</h1>
        <p className="max-w-2xl font-body text-sm text-paper/70">
          Qui porte quoi, les farces en cours, et les garde-fous. Les conditions d&apos;obtention restent secrètes pour les
          membres ; le détail est dans le changelog du lot 35.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-blue/10 px-3 py-2 font-mono text-xs text-blue-light">{msg}</p>}

      <section className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-display text-lg uppercase">Interrupteur général</h2>
          <p className="font-body text-sm text-paper/70">
            {data.enabled ? "Les farces sont actives." : "Les farces sont coupées : plus aucun effet, plus aucun lancement."}
          </p>
        </div>
        <button
          onClick={() => run(() => supabase.rpc("set_trolls_enabled", { p_enabled: !data.enabled }), data.enabled ? "Farces coupées." : "Farces réactivées.")}
          className={`rounded-lg px-4 py-2 font-display text-sm uppercase ${data.enabled ? "border border-red text-red hover:bg-red hover:text-ink" : "bg-blue text-ink hover:bg-blue-light"}`}
        >
          {data.enabled ? "Couper les farces" : "Réactiver les farces"}
        </button>
      </section>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Farces en cours ({active.length})</h2>
        {data.trolls.length === 0 && <p className="font-body text-sm text-paper/60">Aucune farce pour l&apos;instant.</p>}
        <div className="divide-y divide-white/10">
          {data.trolls.slice(0, 40).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 py-2 font-mono text-xs">
              <span className={t.active ? "text-[#7dffb0]" : "text-paper/40"}>{t.active ? "●" : "○"}</span>
              <span className="text-paper">{t.actor}</span>
              <span className="text-paper/50">→ {POWERS[t.power]?.name ?? t.power} →</span>
              <span className="text-paper">{t.target}</span>
              <span className="text-paper/40">{new Date(t.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              {t.cancelled && <span className="text-paper/40">annulée</span>}
              {t.active && (
                <button onClick={() => run(() => supabase.rpc("cancel_troll", { p_id: t.id }), "Farce arrêtée.")} className="ml-auto text-red underline">
                  Arrêter
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Boucliers</h2>
        <p className="font-body text-sm text-paper/70">Un membre sous bouclier ne subit plus aucune farce (et celles en cours s&apos;arrêtent).</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select className={inputClass} value={shieldUser} onChange={(e) => setShieldUser(e.target.value)}>
            <option value="">— Membre —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.nickname}</option>
            ))}
          </select>
          <input className={inputClass} placeholder="Raison (facultatif)" value={shieldReason} onChange={(e) => setShieldReason(e.target.value)} />
          <button
            disabled={!shieldUser}
            onClick={() => run(() => supabase.rpc("set_troll_shield", { p_user: shieldUser, p_on: true, p_reason: shieldReason }), "Bouclier posé.")}
            className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink disabled:opacity-40"
          >
            <SidIcon name="shieldUser" /> Protéger
          </button>
        </div>
        {data.shields.map((s) => (
          <div key={s.user_id} className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span><SidIcon name="shieldUser" /> {s.nickname}</span>
            {s.reason && <span className="text-paper/50">« {s.reason} »</span>}
            <button onClick={() => run(() => supabase.rpc("set_troll_shield", { p_user: s.user_id, p_on: false }), "Bouclier retiré.")} className="ml-auto text-red underline">
              Retirer
            </button>
          </div>
        ))}
      </section>

      <section className="glass-card space-y-3 p-5">
        <h2 className="font-display text-lg uppercase">Donner un titre</h2>
        <p className="font-body text-sm text-paper/70">Pour un événement, ou pour tester un pouvoir avec un compte du bac à sable. Un titre à niveaux monte d&apos;un niveau s&apos;il est déjà possédé.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select className={inputClass} value={grantUser} onChange={(e) => setGrantUser(e.target.value)}>
            <option value="">— Membre —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.nickname}</option>
            ))}
          </select>
          <select className={inputClass} value={grantTitle} onChange={(e) => setGrantTitle(e.target.value as TitleId)}>
            {TITLES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            disabled={!grantUser}
            onClick={() => run(() => supabase.rpc("admin_grant_title", { p_user: grantUser, p_title: grantTitle }), "Titre donné.")}
            className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink disabled:opacity-40"
          >
            Donner
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg uppercase">Porteurs</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TITLES.map((t) => {
            const list = byTitle.get(t.id) ?? [];
            return (
              <div key={t.id} className="glass-card space-y-2 p-4">
                <p className="font-display uppercase" style={{ color: t.colors[0] }}>
                  <SidIcon name={t.icon} /> {t.name} <span className="font-mono text-xs text-paper/50">({list.length})</span>
                </p>
                <p className="font-mono text-[10px] text-paper/45">{t.how}</p>
                {list.length === 0 && <p className="font-body text-xs text-paper/40">Personne.</p>}
                {list.map((h) => (
                  <div key={h.user_id} className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <Link href={`/dashboard/admin/members/${h.user_id}`} className="text-paper hover:underline">{h.nickname}</Link>
                    {isTitleId(h.title_id) && TITLE_BY_ID[h.title_id].maxLevel > 1 && <span className="text-paper/60">niv. {roman(h.level)}</span>}
                    {h.equipped && <span className="text-[#7dffb0]">équipé</span>}
                    <span className="text-paper/40">{sourceObtention(h.source)}</span>
                    <button
                      onClick={() => confirm(`Retirer « ${t.name} » à ${h.nickname} ?`) && run(() => supabase.rpc("admin_revoke_title", { p_user: h.user_id, p_title: t.id }), "Titre retiré.")}
                      className="ml-auto text-red underline"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
