"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { POWERS, TITLE_BY_ID, isTitleId, type TrollPower } from "@/lib/titles";
import { NodeEditor, type NetworkLogic } from "@/components/titles/NodeEditor";
import { inputClass } from "@/lib/ui";

export type TrollStatus = {
  enabled: boolean;
  shielded: boolean;
  title: string | null;
  power: TrollPower | null;
  level: number | null;
  minutes: number | null;
  everyone_allowed: boolean;
  ready_at: string | null;
  ready_all_at: string | null;
  recent: {
    id: number;
    power: TrollPower;
    created_at: string;
    ends_at: string;
    cancelled: boolean;
    target: string;
    responses: { who: string; result: string }[];
  }[];
};

type Member = { id: string; nickname: string };

const RESULT_LABELS: Record<string, string> = {
  victoire: "🗡 t'a vaincu",
  defaite: "🔥 carbonisé",
  fuite: "🏃 a fui",
  fini: "✓",
};

function remaining(iso: string | null, now: number) {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - now);
}

function fmtDuration(ms: number) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** Panneau de lancement du pouvoir du titre équipé. */
export function TrollPanel({ status, myId, initialTarget, onChange }: { status: TrollStatus; myId: string; initialTarget?: string | null; onChange: () => void }) {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [target, setTarget] = useState<string>(initialTarget ?? "");
  const [search, setSearch] = useState("");
  const [everyone, setEveryone] = useState(false);
  const [map, setMap] = useState<Record<string, string>>({});
  const [logic, setLogic] = useState<NetworkLogic>("rotation");
  const [every, setEvery] = useState(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    supabase.rpc("list_roster").then(({ data }) => {
      const list = ((data ?? []) as (Member & { is_invisible?: boolean })[])
        .filter((m) => m && m.id !== myId && !m.is_invisible)
        .map((m) => ({ id: m.id, nickname: m.nickname }));
      setMembers(list);
    });
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialTarget) setTarget(initialTarget);
  }, [initialTarget]);

  const power = status.power ? POWERS[status.power] : null;
  const title = isTitleId(status.title) ? TITLE_BY_ID[status.title] : null;
  const filtered = useMemo(
    () => members.filter((m) => m.nickname.toLowerCase().includes(search.toLowerCase())).slice(0, 60),
    [members, search]
  );

  if (!power || !title) {
    return (
      <div className="glass-card p-6 font-body text-sm text-paper/70">
        Équipe un titre pour débloquer son pouvoir de farce.
      </div>
    );
  }

  const waitOne = remaining(status.ready_at, now);
  const waitAll = remaining(status.ready_all_at, now);
  const wait = everyone ? waitAll : waitOne;
  const canEveryone = status.everyone_allowed;

  async function launch() {
    if (!power) return;
    setBusy(true);
    setMessage(null);
    const params = power.key === "reseau" ? { map, logic, every } : {};
    const { error } = await supabase.rpc("launch_troll", {
      p_power: power.key,
      p_target: everyone ? null : target || null,
      p_params: params,
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
      return;
    }
    const who = everyone ? "tout le S.I.D." : members.find((m) => m.id === target)?.nickname ?? "ta cible";
    setMessage({ ok: true, text: `${power.name} lancé sur ${who} ! ${status.minutes ? `Pendant ${status.minutes} minutes.` : ""}` });
    onChange();
  }

  async function cancel(id: number) {
    await supabase.rpc("cancel_troll", { p_id: id });
    onChange();
  }

  const ready = status.enabled && wait === 0 && (everyone || !!target) && (power.key !== "reseau" || logic === "aleatoire" || Object.keys(map).length > 0);

  return (
    <div className="glass-card relative space-y-4 overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50">Pouvoir de {title.name}</p>
          <h2 className="font-display text-2xl uppercase tracking-wide" style={{ color: title.colors[0] }}>
            {title.emoji} {power.name}
          </h2>
          <p className="max-w-xl font-body text-sm text-paper/75">{power.description}</p>
        </div>
        <div className="text-right font-mono text-xs text-paper/60">
          {status.minutes && <p>Durée : {status.minutes} min</p>}
          {waitOne > 0 ? <p className="text-red">Recharge : {fmtDuration(waitOne)}</p> : <p className="text-[#7dffb0]">Prêt</p>}
          {canEveryone && waitAll > 0 && <p className="text-red">Tout le S.I.D. : {fmtDuration(waitAll)}</p>}
        </div>
      </div>

      {!status.enabled && (
        <p className="rounded-lg border border-red/40 bg-red/10 px-3 py-2 font-mono text-xs text-red">
          Les farces sont désactivées par l&apos;administration pour le moment.
        </p>
      )}

      {canEveryone && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEveryone(false)} className={`rounded-full border px-3 py-1 font-mono text-xs ${!everyone ? "border-blue bg-blue text-ink" : "border-white/20 text-paper/70"}`}>
            Un membre
          </button>
          <button type="button" onClick={() => setEveryone(true)} className={`rounded-full border px-3 py-1 font-mono text-xs ${everyone ? "border-red bg-red text-ink" : "border-white/20 text-paper/70"}`}>
            Tout le S.I.D. (recharge 24 h)
          </button>
        </div>
      )}

      {!everyone && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input className={inputClass} placeholder="Chercher un membre…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— Choisir la cible —</option>
            {filtered.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nickname}
              </option>
            ))}
            {target && !filtered.some((m) => m.id === target) && (
              <option value={target}>{members.find((m) => m.id === target)?.nickname ?? "Cible choisie"}</option>
            )}
          </select>
        </div>
      )}

      {power.key === "reseau" && <NodeEditor map={map} onChange={setMap} logic={logic} onLogic={setLogic} every={every} onEvery={setEvery} />}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={launch}
          disabled={!ready || busy}
          className="troll-launch rounded-lg px-5 py-2.5 font-display text-sm uppercase tracking-wide text-ink disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: `linear-gradient(110deg, ${title.colors[0]}, ${title.colors[1]})` }}
        >
          {busy ? "…" : power.key === "defi_dragon" ? "🐉 Me transformer et provoquer" : "🎭 Lancer la farce"}
        </button>
        {message && <p className={`font-mono text-xs ${message.ok ? "text-[#7dffb0]" : "text-red"}`}>{message.text}</p>}
      </div>

      <p className="font-mono text-[10px] text-paper/40">
        Une seule farce à la fois par membre, puis 30 minutes de répit pour lui. Ta cible voit qui l&apos;a trollée.
      </p>

      {status.recent.length > 0 && (
        <div className="space-y-1 border-t border-white/10 pt-3">
          <p className="font-mono text-xs uppercase tracking-wide text-paper/50">Tes farces récentes</p>
          {status.recent.map((r) => {
            const active = !r.cancelled && new Date(r.ends_at).getTime() > now;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2 font-mono text-xs text-paper/70">
                <span>{POWERS[r.power]?.name ?? r.power}</span>
                <span className="text-paper/40">→</span>
                <span className="text-paper">{r.target}</span>
                <span className="text-paper/40">{new Date(r.created_at).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                {active && <span className="rounded-full bg-[#7dffb0]/15 px-2 text-[#7dffb0]">en cours</span>}
                {r.cancelled && <span className="text-paper/40">annulée</span>}
                {r.responses.length > 0 && (
                  <span className="text-paper/60">
                    {r.responses.slice(0, 6).map((x) => `${x.who} ${RESULT_LABELS[x.result] ?? x.result}`).join(" · ")}
                    {r.responses.length > 6 ? ` · +${r.responses.length - 6}` : ""}
                  </span>
                )}
                {active && (
                  <button onClick={() => cancel(r.id)} className="ml-auto text-red underline">
                    Arrêter
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
