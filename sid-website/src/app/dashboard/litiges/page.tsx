"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import { useDeepLink } from "@/lib/deeplink";
import { SidIcon } from "@/components/icons/SidIcon";
import { day, when, z } from "@/lib/econ";
import { inputClass, labelClass } from "@/lib/ui";
import { DISPUTE_CATEGORIES, DISPUTE_STATUS, type Dispute, type DisputeCategory, type DisputeStatus } from "@/types/economy";
import "@/components/litiges/litiges.css";

type View = "mine" | "open" | "closed";

const STATUS_TONE: Record<DisputeStatus, string> = {
  open: "text-yellow-300",
  settled: "text-green-300",
  upheld: "text-blue-light",
  rejected: "text-red",
  withdrawn: "text-paper/60",
};

function Face({ name, url, sub }: { name: string | null; url: string | null; sub: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-lg uppercase text-paper/80">
          {(name ?? "?").slice(0, 1)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-display uppercase text-paper">{name ?? "—"}</span>
        <span className="block truncate font-mono text-[10px] uppercase text-paper/50">{sub}</span>
      </span>
    </div>
  );
}

export default function LitigesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [judge, setJudge] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [view, setView] = useState<View>("mine");
  const [list, setList] = useState<Dispute[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [missing, setMissing] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    loadCurrentUser().then(({ profile, permissions }) => {
      setMe(profile?.id ?? null);
      const j = can(permissions, "manage_economy") || can(permissions, "manage_users");
      setJudge(j);
      if (j && new URLSearchParams(window.location.search).get("vue") === "juge") setView("open");
    });
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("disputes_list", { p_scope: view });
    if (error) {
      if (error.message.includes("disputes_list")) setMissing(true);
      return setList([]);
    }
    setList((data ?? []) as Dispute[]);
  }, [supabase, view]);

  useEffect(() => {
    load();
  }, [load, version]);

  useDeepLink("litige", true, (id) => setSel(id));

  const refreshAll = () => setVersion((v) => v + 1);

  if (missing) return <p className="glass-card max-w-2xl p-6 font-body text-sm text-paper/70">Les litiges demandent la migration 0086.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="glass-card flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-paper/55">Le greffe</p>
          <h1 className="font-display text-3xl uppercase tracking-wide text-red">Litiges</h1>
          <p className="mt-1 max-w-2xl font-body text-sm text-paper/70">
            Un achat jamais livré, un salaire pas versé, un contrat non tenu : ouvre un litige contre le membre ou l&apos;entreprise. Vous en discutez ici ; le
            défendeur peut accepter de payer, sinon un admin tranche.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpening((o) => !o);
            setSel(null);
          }}
          className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase tracking-wide text-ink hover:bg-red-light"
        >
          {opening ? "Fermer" : "Ouvrir un litige"}
        </button>
      </header>

      {opening && (
        <OpenForm
          me={me}
          onDone={(id) => {
            setOpening(false);
            setView("mine");
            setSel(id);
            refreshAll();
          }}
        />
      )}

      {judge && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {(
            [
              ["mine", "Mes litiges"],
              ["open", "À trancher"],
              ["closed", "Clos (90 j)"],
            ] as [View, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`rounded-full border px-4 py-1.5 font-mono text-xs uppercase ${view === k ? "border-blue bg-blue/10 text-blue-light" : "border-white/15 text-paper/65 hover:text-paper"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label="Liste des litiges" className="space-y-2 self-start">
          {list === null ? (
            <p className="glass-card p-5 font-body text-sm text-paper/60">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="glass-card p-5 font-body text-sm text-paper/60">{view === "mine" ? "Aucun litige te concernant." : "Rien ici."}</p>
          ) : (
            list.map((d) => (
              <button key={d.id} type="button" onClick={() => { setSel(d.id); setOpening(false); }} className={`greffe-card block w-full p-4 text-left ${sel === d.id ? "is-on" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="greffe-num">N° {d.number} · {DISPUTE_CATEGORIES[d.category]}</span>
                  <span className={`stamp !text-[0.6rem] ${STATUS_TONE[d.status]}`}>{DISPUTE_STATUS[d.status]}</span>
                </div>
                <p className="mt-1 font-display uppercase leading-tight text-paper">{d.subject}</p>
                <p className="mt-1 truncate font-body text-xs text-paper/65">
                  {d.plaintiff} contre {d.business_name ?? d.defendant}
                  {d.claimed > 0 && <span className="font-mono"> · {z(d.claimed, 0)}</span>}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-paper/45">
                  {d.messages_count} message{d.messages_count > 1 ? "s" : ""} · {when(d.last_activity_at)}
                  {d.role !== "juge" && <span className="text-[#f0c27a]"> · tu es {d.role === "demandeur" ? "demandeur" : "défendeur"}</span>}
                </p>
              </button>
            ))
          )}
        </section>

        {sel ? (
          <DisputeView key={`${sel}-${version}`} id={sel} me={me} judge={judge} onChanged={refreshAll} />
        ) : (
          !opening && (
            <div className="glass-card hidden place-items-center p-10 text-center lg:grid">
              <div className="space-y-2">
                <SidIcon name="gavel" size={48} />
                <p className="font-body text-sm text-paper/60">Choisis un litige pour lire le dossier.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Ouvrir
function OpenForm({ me, onDone }: { me: string | null; onDone: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [kind, setKind] = useState<"membre" | "entreprise">("membre");
  const [members, setMembers] = useState<{ id: string; nickname: string }[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string; founder_id: string | null }[]>([]);
  const [fee, setFee] = useState<number | null>(null);
  const [f, setF] = useState({ who: "", category: "paiement" as DisputeCategory, subject: "", claimed: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id, nickname").eq("status", "active").order("nickname"),
      supabase.from("businesses").select("id, name, founder_id").eq("is_closed", false).order("name"),
      supabase.rpc("dispute_fee"),
    ]).then(([m, b, fe]) => {
      setMembers(((m.data ?? []) as { id: string; nickname: string }[]).filter((x) => x.id !== me));
      setBusinesses(((b.data ?? []) as { id: string; name: string; founder_id: string | null }[]).filter((x) => x.founder_id !== me));
      if (fe.data != null) setFee(Number(fe.data));
    });
  }, [supabase, me]);

  return (
    <form
      className="glass-card grid gap-4 p-6 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const { data, error } = await supabase.rpc("dispute_open", {
          p_against_user: kind === "membre" ? f.who : null,
          p_against_business: kind === "entreprise" ? f.who : null,
          p_category: f.category,
          p_subject: f.subject,
          p_body: f.body,
          p_claimed: Number(f.claimed) || 0,
        });
        setBusy(false);
        if (error) return setErr(error.message);
        onDone(data as string);
      }}
    >
      <div className="space-y-3">
        <p className="font-display text-lg uppercase">Nouveau litige</p>
        <div className="flex gap-2">
          {(["membre", "entreprise"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setF((x) => ({ ...x, who: "" }));
              }}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase ${kind === k ? "border-blue text-blue-light" : "border-white/15 text-paper/60"}`}
            >
              Contre {k === "membre" ? "un membre" : "une entreprise"}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className={labelClass}>{kind === "membre" ? "Membre" : "Entreprise (son fondateur répond)"}</span>
          <select required className={inputClass} value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}>
            <option value="">Choisir…</option>
            {(kind === "membre" ? members.map((m) => ({ id: m.id, l: m.nickname })) : businesses.map((b) => ({ id: b.id, l: b.name }))).map((o) => (
              <option key={o.id} value={o.id}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className={labelClass}>Catégorie</span>
            <select className={inputClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DisputeCategory })}>
              {(Object.keys(DISPUTE_CATEGORIES) as DisputeCategory[]).map((k) => (
                <option key={k} value={k}>
                  {DISPUTE_CATEGORIES[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={labelClass}>Somme réclamée</span>
            <input type="number" min={0} className={inputClass} value={f.claimed} onChange={(e) => setF({ ...f, claimed: e.target.value })} placeholder="0" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className={labelClass}>Objet</span>
          <input required minLength={3} maxLength={120} className={inputClass} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Ex. : lanterne payée, jamais livrée" />
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-1 flex-col space-y-1">
          <span className={labelClass}>Les faits</span>
          <textarea required minLength={20} maxLength={2000} rows={7} className={`${inputClass} flex-1`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Ce qui s'est passé, quand, ce qui était convenu, ce que tu as déjà tenté." />
          <span className="text-right font-mono text-[10px] text-paper/45">{f.body.length} / 2 000</span>
        </label>
        <p className="font-body text-xs text-paper/60">
          Frais de dossier : <b className="text-paper">{fee == null ? "…" : z(fee, 0)}</b>, prélevés à l&apos;ouverture et remboursés si le litige aboutit (accord ou
          plainte fondée). Trois litiges ouverts au plus.
        </p>
        {err && <p className="font-mono text-xs text-red">{err}</p>}
        <button type="submit" disabled={busy || !f.who} className="rounded-lg bg-red py-2.5 font-display uppercase tracking-wide text-ink hover:bg-red-light disabled:opacity-40">
          {busy ? "Dépôt…" : "Déposer la plainte"}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ Dossier
function DisputeView({ id, me, judge, onChanged }: { id: string; me: string | null; judge: boolean; onChanged: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Dispute | null | undefined>(undefined);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("dispute_detail", { p_dispute: id });
    setD((data ?? null) as Dispute | null);
  }, [supabase, id]);
  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>, after?: () => void) {
    setBusy(true);
    setErr(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setErr(error.message);
    after?.();
    await load();
    onChanged();
  }

  if (d === undefined) return <p className="glass-card p-6 font-body text-sm text-paper/60">Ouverture du dossier…</p>;
  if (d === null) return <p className="glass-card p-6 font-body text-sm text-paper/60">Dossier introuvable ou réservé aux parties.</p>;

  const open = d.status === "open";
  const party = d.role === "demandeur" || d.role === "defendeur";
  const canJudge = judge && open && d.opened_by !== me && d.defendant_id !== me;

  return (
    <section className="glass-card min-w-0 space-y-5 p-5" aria-label={`Litige n° ${d.number}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="greffe-num">
            Litige n° {d.number} · {DISPUTE_CATEGORIES[d.category]} · ouvert le {day(d.created_at)}
          </p>
          <h2 className="font-display text-2xl uppercase leading-tight tracking-wide text-paper">{d.subject}</h2>
        </div>
        <span className={`stamp ${STATUS_TONE[d.status]}`}>{DISPUTE_STATUS[d.status]}</span>
      </div>

      <div className="greffe-versus rounded-xl border border-white/10 bg-black/10 p-4">
        <Face name={d.plaintiff} url={d.plaintiff_avatar} sub="demandeur" />
        <span className="vs">contre</span>
        <Face name={d.business_name ?? d.defendant} url={d.business_name ? null : d.defendant_avatar} sub={d.business_name ? `entreprise de ${d.defendant}` : "défendeur"} />
      </div>

      <dl className="grid grid-cols-2 gap-3 font-mono text-[11px] sm:grid-cols-4">
        <div>
          <dt className="uppercase text-paper/55">Réclamé</dt>
          <dd className="font-display text-xl text-paper">{z(d.claimed, 0)}</dd>
        </div>
        <div>
          <dt className="uppercase text-paper/55">Frais de dossier</dt>
          <dd className="text-paper">{z(d.fee, 0)}</dd>
        </div>
        {!open && (
          <div>
            <dt className="uppercase text-paper/55">Accordé</dt>
            <dd className="font-display text-xl text-blue-light">{z(d.award, 0)}</dd>
          </div>
        )}
        {d.fine > 0 && (
          <div>
            <dt className="uppercase text-paper/55">Amende</dt>
            <dd className="text-red-light">
              {z(d.fine, 0)} ({d.fine_target === "defendeur" ? "défendeur" : "demandeur"})
            </dd>
          </div>
        )}
      </dl>

      {!open && d.decision && (
        <div className="greffe-verdict space-y-2 p-4">
          <span className={`stamp ${STATUS_TONE[d.status]}`}>{DISPUTE_STATUS[d.status]}</span>
          <p className="whitespace-pre-line font-body text-sm text-paper/85">{d.decision}</p>
          <p className="font-mono text-[10px] uppercase text-paper/50">
            {d.decided_by ? `Décision de ${d.decided_by}` : ""} {d.decided_at ? `· ${when(d.decided_at)}` : ""}
          </p>
        </div>
      )}

      <ol className="space-y-3" aria-label="Échanges">
        {(d.messages ?? []).map((m) =>
          m.kind === "event" ? (
            <li key={m.id} className="greffe-event">
              — {m.body} —
              <span className="block text-[10px] text-paper/40">{when(m.created_at)}</span>
            </li>
          ) : (
            <li key={m.id} className={`greffe-msg is-${m.side}`}>
              <p className="mb-1 font-mono text-[10px] uppercase text-paper/55">
                {m.author ?? "—"}
                {m.side === "juge" && " · admin"} · {when(m.created_at)}
              </p>
              {m.body}
            </li>
          )
        )}
      </ol>

      {err && <p className="font-mono text-xs text-red">{err}</p>}

      {open && (party || judge) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reply.trim()) return;
            act(() => supabase.rpc("dispute_post", { p_dispute: d.id, p_body: reply }), () => setReply(""));
          }}
        >
          <textarea rows={3} maxLength={2000} className={inputClass} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={d.role === "juge" ? "Question aux parties…" : "Ta réponse, tes preuves…"} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || !reply.trim()} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40">
              Envoyer
            </button>
            {d.role === "defendeur" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!confirm(d.claimed > 0 ? `Payer ${z(d.claimed)} à ${d.plaintiff}${d.business_name ? ` depuis la trésorerie de ${d.business_name}` : ""} et clore le litige ?` : "Accepter la plainte et clore le litige ?")) return;
                  act(() => supabase.rpc("dispute_accept", { p_dispute: d.id }));
                }}
                className="rounded-lg border border-green-400/60 px-4 py-2 font-mono text-xs uppercase text-green-300 hover:bg-green-400/10 disabled:opacity-40"
              >
                {d.claimed > 0 ? `Accepter et payer ${z(d.claimed, 0)}` : "Accepter"}
              </button>
            )}
            {d.role === "demandeur" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!confirm("Retirer ta plainte ? Les frais de dossier ne sont pas remboursés.")) return;
                  act(() => supabase.rpc("dispute_withdraw", { p_dispute: d.id }));
                }}
                className="ml-auto font-mono text-[11px] uppercase text-paper/55 hover:text-red-light"
              >
                Retirer la plainte
              </button>
            )}
          </div>
        </form>
      )}

      {canJudge && <Verdict d={d} busy={busy} onDecide={(args) => act(() => supabase.rpc("dispute_decide", args))} />}
      {judge && open && !canJudge && <p className="font-mono text-[11px] text-paper/50">Tu es partie à ce litige : un autre admin le tranchera.</p>}
    </section>
  );
}

function Verdict({ d, busy, onDecide }: { d: Dispute; busy: boolean; onDecide: (args: Record<string, unknown>) => void }) {
  const [upheld, setUpheld] = useState(true);
  const [award, setAward] = useState(String(d.claimed));
  const [fine, setFine] = useState("");
  const [target, setTarget] = useState<"defendeur" | "demandeur">("defendeur");
  const [text, setText] = useState("");
  return (
    <form
      className="space-y-3 rounded-xl border border-[#f0c27a]/40 bg-[#f0c27a]/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(upheld ? `Plainte fondée : ${z(Number(award) || 0)} pris au défendeur, même s'il passe en négatif. Confirmer ?` : "Rejeter la plainte ?")) return;
        onDecide({ p_dispute: d.id, p_upheld: upheld, p_award: upheld ? Number(award) || 0 : 0, p_fine: Number(fine) || 0, p_fine_target: Number(fine) > 0 ? target : null, p_decision: text });
      }}
    >
      <p className="font-display uppercase text-[#f0c27a]">
        <SidIcon name="gavel" size={16} /> Trancher
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          [true, "Plainte fondée"],
          [false, "Plainte rejetée"],
        ].map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={upheld === v}
            onClick={() => {
              setUpheld(v as boolean);
              setTarget(v ? "defendeur" : "demandeur");
            }}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase ${upheld === v ? "border-[#f0c27a] text-[#f0c27a]" : "border-white/15 text-paper/60"}`}
          >
            {l as string}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {upheld && (
          <label className="space-y-1">
            <span className={labelClass}>Somme accordée</span>
            <input type="number" min={0} className={inputClass} value={award} onChange={(e) => setAward(e.target.value)} />
          </label>
        )}
        <label className="space-y-1">
          <span className={labelClass}>Amende (facultative)</span>
          <input type="number" min={0} className={inputClass} value={fine} onChange={(e) => setFine(e.target.value)} placeholder="0" />
        </label>
        {Number(fine) > 0 && (
          <label className="space-y-1">
            <span className={labelClass}>Payée par</span>
            <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value as "defendeur" | "demandeur")}>
              <option value="defendeur">le défendeur</option>
              <option value="demandeur">le demandeur</option>
            </select>
          </label>
        )}
      </div>
      <label className="block space-y-1">
        <span className={labelClass}>Motivation (lue par les deux parties)</span>
        <textarea required minLength={10} maxLength={1000} rows={3} className={inputClass} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <p className="font-body text-xs text-paper/60">
        Fondée : la somme est versée au demandeur et ses frais de dossier remboursés. L&apos;amende suit le circuit des impôts (7 jours pour payer, sinon saisie +10 %).
      </p>
      <button type="submit" disabled={busy || text.trim().length < 10} className="rounded-lg bg-[#f0c27a] px-4 py-2 font-display text-sm uppercase tracking-wide text-ink hover:brightness-110 disabled:opacity-40">
        Rendre la décision
      </button>
    </form>
  );
}
