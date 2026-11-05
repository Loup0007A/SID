"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import { SidIcon } from "@/components/icons/SidIcon";
import { PollCard, type Poll } from "@/components/polls/PollCard";
import { useDeepLink } from "@/lib/deeplink";

/** Sondages (Lot 65) : votés par tous les membres, créés par l'administration. */
export default function PollsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("polls_list", { p_limit: 60 });
    setPolls((data ?? []) as Poll[]);
  }, [supabase]);

  useEffect(() => {
    load();
    loadCurrentUser().then(({ profile, permissions }) => setAdmin(!!profile && can(permissions, "manage_users") && !profile.sandbox_expires_at));
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load]);

  useDeepLink("sondage", !!polls, (id) => {
    setFocus(id);
    requestAnimationFrame(() => document.getElementById(`sondage-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    window.setTimeout(() => setFocus(null), 2500);
  });

  const scheduled = polls?.filter((p) => p.scheduled) ?? [];
  const open = polls?.filter((p) => p.is_open) ?? [];
  const closed = polls?.filter((p) => !p.is_open && !p.scheduled) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Le S.I.D.</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">Sondages</h1>
        </div>
        {admin && !creating && (
          <button onClick={() => setCreating(true)} className="shop-buy">
            <SidIcon name="pen" size={15} /> Nouveau sondage
          </button>
        )}
      </header>

      {admin && creating && (
        <NewPoll
          onCancel={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await load();
            setFocus(id);
            window.setTimeout(() => setFocus(null), 2500);
          }}
        />
      )}

      {polls === null ? (
        <p className="font-mono text-xs text-paper/60">Chargement…</p>
      ) : polls.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <SidIcon name="ballot" size={40} />
          <p className="font-display text-lg uppercase">Aucun sondage pour l&apos;instant</p>
        </div>
      ) : (
        <>
          {scheduled.length > 0 && (
            <section className="space-y-3" aria-labelledby="polls-scheduled">
              <h2 id="polls-scheduled" className="font-mono text-xs uppercase tracking-[0.2em] text-paper/60">
                Programmés · visibles des admins seulement
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {scheduled.map((p) => (
                  <PollCard key={p.id} poll={p} admin={admin} highlight={focus === p.id} onChanged={load} />
                ))}
              </div>
            </section>
          )}
          {open.length > 0 && (
            <section className="grid gap-4 lg:grid-cols-2" aria-label="Sondages ouverts">
              {open.map((p) => (
                <PollCard key={p.id} poll={p} admin={admin} highlight={focus === p.id} onChanged={load} />
              ))}
            </section>
          )}
          {closed.length > 0 && (
            <section className="space-y-3" aria-labelledby="polls-closed">
              <h2 id="polls-closed" className="font-mono text-xs uppercase tracking-[0.2em] text-paper/60">
                Clos
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {closed.map((p) => (
                  <PollCard key={p.id} poll={p} admin={admin} highlight={focus === p.id} onChanged={load} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const CLOSES: [string, string][] = [
  ["", "Pas de date (clos à la main)"],
  ["24", "Après 24 heures"],
  ["72", "Après 3 jours"],
  ["168", "Après 7 jours"],
  ["custom", "Date précise…"],
];

function NewPoll({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [question, setQuestion] = useState("");
  const [details, setDetails] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [show, setShow] = useState<Poll["show_results"]>("after_vote");
  const [closes, setCloses] = useState("");
  const [custom, setCustom] = useState("");
  const [notify, setNotify] = useState(true);
  const [publish, setPublish] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filled = options.filter((o) => o.trim()).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    let closesAt: string | null = null;
    if (closes === "custom") {
      if (!custom) return setErr("Choisis la date de clôture.");
      closesAt = new Date(custom).toISOString();
    }
    let publishAt: string | null = null;
    if (publish) {
      const at = new Date(publish);
      if (at.getTime() <= Date.now() + 60_000) return setErr("La publication doit être dans le futur.");
      publishAt = at.toISOString();
    }
    if (closes && closes !== "custom") {
      closesAt = new Date((publishAt ? new Date(publishAt).getTime() : Date.now()) + Number(closes) * 3_600_000).toISOString();
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("poll_create", {
      p_question: question,
      p_details: details || null,
      p_options: options,
      p_multiple: multiple,
      p_anonymous: anonymous,
      p_show_results: show,
      p_closes_at: closesAt,
      p_notify: notify,
      ...(publishAt ? { p_publish_at: publishAt } : {}),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    onCreated(data as string);
  }

  return (
    <form onSubmit={submit} className="poll-card space-y-1" aria-labelledby="poll-new">
      <h2 id="poll-new" className="font-display text-xl uppercase tracking-wide">
        Nouveau sondage
      </h2>
      <label className="block space-y-1">
        <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Question</span>
        <input value={question} onChange={(e) => setQuestion(e.target.value.slice(0, 200))} required minLength={3} className="field-dark" placeholder="Quel jour pour la prochaine soirée RP ?" />
      </label>
      <label className="block space-y-1">
        <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Précisions (facultatif)</span>
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={2} className="field-dark" />
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-mono text-xs uppercase tracking-wide text-paper/70">Réponses ({filled}/12)</legend>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={o}
              onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value.slice(0, 120) : x)))}
              className="field-dark"
              aria-label={`Réponse ${i + 1}`}
              placeholder={`Réponse ${i + 1}`}
            />
            {options.length > 2 && (
              <button type="button" onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} className="rounded-lg border border-white/15 px-3 text-paper/70 hover:text-red" aria-label={`Retirer la réponse ${i + 1}`}>
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < 12 && (
          <button type="button" onClick={() => setOptions((all) => [...all, ""])} className="font-mono text-[11px] uppercase text-blue hover:underline">
            + Ajouter une réponse
          </button>
        )}
      </fieldset>

      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Résultats visibles</span>
          <select value={show} onChange={(e) => setShow(e.target.value as Poll["show_results"])} className="field-dark">
            <option value="after_vote">Après avoir voté</option>
            <option value="always">Tout le temps</option>
            <option value="after_close">À la clôture seulement</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Clôture</span>
          <select value={closes} onChange={(e) => setCloses(e.target.value)} className="field-dark">
            {CLOSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Publication</span>
          <input type="datetime-local" value={publish} onChange={(e) => setPublish(e.target.value)} className="field-dark" aria-describedby="poll-publish-hint" />
          <span id="poll-publish-hint" className="block font-mono text-[10px] text-paper/55">
            {publish ? "Invisible des membres jusqu'à cette date ; la notification part à ce moment-là." : "Vide : publié tout de suite."}
          </span>
        </label>
        {closes === "custom" && (
          <label className="space-y-1 sm:col-span-2">
            <span className="font-mono text-xs uppercase tracking-wide text-paper/70">Date de clôture</span>
            <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="field-dark" />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 font-body text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> Plusieurs choix possibles
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!anonymous} onChange={(e) => setAnonymous(!e.target.checked)} /> Afficher qui a voté quoi
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Prévenir les membres
        </label>
      </div>

      {err && (
        <p role="alert" className="font-body text-sm text-red">
          {err}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase hover:border-white/40">
          Annuler
        </button>
        <button type="submit" disabled={busy || question.trim().length < 3 || filled < 2} className="shop-buy">
          {busy ? "…" : publish ? "Programmer" : "Publier"}
        </button>
      </div>
    </form>
  );
}
