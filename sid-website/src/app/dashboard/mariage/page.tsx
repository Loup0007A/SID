"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LivretCover, LivretSpread, METALS, RingArt, acteNo, metalLabel, type Metal, type Person, type Union } from "@/components/wedding/Livret";

/**
 * Mariages (Lot 66) : demande, réponse, livret d'union et registre.
 * Règles : supabase/migrations/0081. Page réservée aux admins tant qu'elle
 * n'est pas dévoilée depuis Modération.
 */

type State = {
  open: boolean;
  public?: boolean;
  admin?: boolean;
  me?: Person;
  union?: Union | null;
  incoming?: Union[];
  outgoing?: Union | null;
  registry?: Union[];
};

const SEEN_KEY = "sid-livret-ouvert";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function seenOpening(id: string) {
  try {
    return (localStorage.getItem(SEEN_KEY) ?? "").split(",").includes(id);
  } catch {
    return true;
  }
}
function markOpening(id: string) {
  try {
    const all = (localStorage.getItem(SEEN_KEY) ?? "").split(",").filter(Boolean);
    localStorage.setItem(SEEN_KEY, [...all, id].slice(-20).join(","));
  } catch {
    /* stockage indisponible */
  }
}

function Avatar({ p }: { p: Person }) {
  return p.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.avatar_url} alt="" />
  ) : (
    <span>{p.nickname.slice(0, 1).toUpperCase()}</span>
  );
}

export default function MariagePage() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("wedding_state");
    if (error) {
      setError(error.message.includes("wedding_state") ? "Les mariages arrivent avec la migration 0081, pas encore lancée sur la base." : error.message);
      return;
    }
    const s = (data ?? { open: false }) as State;
    setState(s);
    if (s.union && !seenOpening(s.union.id)) {
      setOpening(true);
      markOpening(s.union.id);
    }
  }, [supabase]);

  useEffect(() => {
    load();
    supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .eq("status", "active")
      .order("nickname")
      .then(({ data }) => setMembers((data ?? []) as Person[]));
  }, [load, supabase]);

  async function call(fn: string, args: Record<string, unknown>, done?: string) {
    setNotice(null);
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      setNotice(error.message);
      return false;
    }
    if (done) setNotice(done);
    await load();
    return true;
  }

  if (error) return <p className="font-mono text-sm text-paper/70">{error}</p>;
  if (!state) return <p className="font-mono text-xs text-paper/60">Ouverture du registre…</p>;
  if (!state.open) {
    return (
      <div className="wed mx-auto flex max-w-md flex-col items-center gap-6 py-10 text-center">
        <LivretCover />
        <p className="font-body text-paper/75">Le registre des unions n&apos;est pas encore ouvert.</p>
      </div>
    );
  }

  const me = state.me!;
  const registry = state.registry ?? [];
  const taken = new Set(registry.flatMap((u) => [u.a.id, u.b.id]));
  const candidates = members.filter((m) => m.id !== me.id && !taken.has(m.id));

  return (
    <div className="wed space-y-12">
      {!state.public && (
        <p className="rounded-lg border border-[#d8b46a]/40 bg-[#d8b46a]/10 px-4 py-2 font-body text-sm text-[#f4e0a6]">
          Aperçu réservé aux admins. La page apparaîtra pour tous quand tu la dévoileras dans{" "}
          <Link href="/dashboard/admin/moderation" className="underline">
            Modération
          </Link>
          .
        </p>
      )}

      {state.union ? (
        <section className="space-y-4" aria-labelledby="wed-titre">
          <h1 id="wed-titre" className="font-display text-3xl tracking-wide">
            Votre livret d&apos;union
          </h1>
          <LivretSpread u={state.union} opening={opening}>
            <Wishes u={state.union} />
          </LivretSpread>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                const other = state.union!.a.id === me.id ? state.union!.b : state.union!.a;
                if (confirm(`Mettre fin à ton union avec ${other.nickname} ? L'acte restera au registre comme rompu.`))
                  call("wedding_divorce", { p_id: state.union!.id }, "L'union est rompue.");
              }}
              className="font-mono text-[11px] text-paper/50 hover:text-red-light"
            >
              Mettre fin à l&apos;union
            </button>
          </div>
        </section>
      ) : (
        <section className="grid items-start gap-8 md:grid-cols-[minmax(0,300px)_1fr] md:gap-12" aria-labelledby="wed-titre">
          <div className="mx-auto w-[min(52vw,300px)] md:mx-0 md:w-full">
            <LivretCover shine />
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 id="wed-titre" className="font-display text-4xl tracking-wide">
                Registre des unions
              </h1>
              <p className="max-w-prose font-body text-lg text-paper/75">
                Une demande, une réponse, et l&apos;union est inscrite au registre du S.I.D. avec son acte et son numéro.
              </p>
            </div>

            {(state.incoming ?? []).map((u) => (
              <Incoming key={u.id} u={u} onAnswer={(accept, vow) => call("wedding_answer", { p_id: u.id, p_accept: accept, p_vow: vow || null }, accept ? undefined : "Demande déclinée.")} />
            ))}

            {state.outgoing ? (
              <div className="wed-slip">
                <p className="font-body text-lg">
                  Ta demande à <em>{state.outgoing.b.nickname}</em> attend sa réponse.
                </p>
                <p className="mt-1 font-body text-sm text-[#5a6070]">
                  Envoyée le {shortDate(state.outgoing.proposed_at)}, alliance {metalLabel(state.outgoing.ring).toLowerCase()}.
                </p>
                <button
                  type="button"
                  onClick={() => call("wedding_cancel", { p_id: state.outgoing!.id }, "Demande retirée.")}
                  className="mt-3 font-body text-sm text-[#5b1e2a] underline hover:no-underline"
                >
                  Retirer ma demande
                </button>
              </div>
            ) : (
              (state.incoming ?? []).length === 0 && <Propose me={me} candidates={candidates} onSend={(to, ring, vow) => call("wedding_propose", { p_partner: to, p_ring: ring, p_vow: vow || null }, "Demande envoyée.")} />
            )}
          </div>
        </section>
      )}

      {notice && (
        <p role="status" className="font-body text-sm text-[#f4e0a6]">
          {notice}
        </p>
      )}

      <Registry registry={registry} me={me} admin={!!state.admin} onWish={(id, msg) => call("wedding_wish", { p_id: id, p_message: msg }, "Merci, ton mot est inscrit.")} onRemoveWish={(id) => call("wedding_wish_remove", { p_id: id })} onAnnul={(u) => {
        if (confirm(`Annuler l'union de ${u.a.nickname} et ${u.b.nickname} ? Les deux seront prévenus.`)) call("wedding_annul", { p_id: u.id }, "Union annulée.");
      }} />
    </div>
  );
}

// ------------------------------------------------------------------ Demande
function Propose({ me, candidates, onSend }: { me: Person; candidates: Person[]; onSend: (to: string, ring: Metal, vow: string) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [to, setTo] = useState<Person | null>(null);
  const [ring, setRing] = useState<Metal>("or");
  const [vow, setVow] = useState("");
  const [busy, setBusy] = useState(false);
  const q = query.trim().toLowerCase();
  const shown = q ? candidates.filter((m) => m.nickname.toLowerCase().includes(q)).slice(0, 6) : [];

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!to) return;
        setBusy(true);
        const ok = await onSend(to.id, ring, vow.trim());
        setBusy(false);
        if (ok) {
          setTo(null);
          setVow("");
        }
      }}
    >
      <div className="space-y-5">
        <h2 className="font-display text-xl tracking-wide">Faire sa demande</h2>

        <div className="space-y-2">
          <label htmlFor="wed-qui" className="block font-body text-sm text-paper/75">
            À qui ?
          </label>
          {to ? (
            <div className="flex items-center gap-3">
              <span className="registre-avatars">
                <Avatar p={to} />
              </span>
              <span className="font-body text-lg italic">{to.nickname}</span>
              <button type="button" onClick={() => setTo(null)} className="font-body text-sm text-paper/60 underline hover:text-paper">
                changer
              </button>
            </div>
          ) : (
            <>
              <input id="wed-qui" value={query} onChange={(e) => setQuery(e.target.value)} className="field-dark" placeholder="Pseudo d'un membre" autoComplete="off" />
              {shown.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Membres trouvés">
                  {shown.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setTo(m);
                          setQuery("");
                        }}
                        className="flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-3 font-body text-sm hover:border-[#d8b46a]"
                      >
                        <span className="registre-avatars">
                          <Avatar p={m} />
                        </span>
                        {m.nickname}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q && shown.length === 0 && <p className="font-body text-sm text-paper/55">Personne de libre sous ce nom.</p>}
            </>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-body text-sm text-paper/75">L&apos;alliance</legend>
          <div role="radiogroup" aria-label="L'alliance" className="grid grid-cols-4 gap-2">
            {METALS.map((m) => (
              <button key={m.key} type="button" role="radio" aria-checked={ring === m.key} onClick={() => setRing(m.key)} className="wed-ring-pick">
                <RingArt metal={m.key} size={48} />
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="wed-promesse" className="block font-body text-sm text-paper/75">
            Ta promesse <span className="text-paper/50">(facultatif, recopiée sur l&apos;acte)</span>
          </label>
          <textarea id="wed-promesse" value={vow} onChange={(e) => setVow(e.target.value.slice(0, 600))} rows={4} className="field-dark" />
          <p className="text-right font-mono text-[10px] text-paper/45">{vow.length}/600</p>
        </div>

        <button type="submit" disabled={!to || busy} className="rounded-xl bg-[#d8b46a] px-6 py-3 font-display text-lg tracking-wide text-[#34101a] transition hover:bg-[#f4e0a6] disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Envoi…" : "Envoyer ma demande"}
        </button>
      </div>

      <aside aria-label="Ce que recevra l'autre membre" className="space-y-2">
        <p className="font-body text-sm text-paper/60">Ce que {to ? to.nickname : "l'autre"} recevra</p>
        <div className="wed-slip">
          <div className="flex items-start justify-between gap-3">
            <p className="font-body text-lg leading-snug">
              <em>{me.nickname}</em> te demande en mariage.
            </p>
            <RingArt metal={ring} size={52} />
          </div>
          <p className="livret-vow mt-3 min-h-[3rem] text-base">{vow.trim() ? `« ${vow.trim()} »` : <span className="text-[#5a6070]">Ta promesse s&apos;affichera ici.</span>}</p>
        </div>
      </aside>
    </form>
  );
}

// ------------------------------------------------------------------ Demande reçue
function Incoming({ u, onAnswer }: { u: Union; onAnswer: (accept: boolean, vow: string) => Promise<boolean> }) {
  const [vow, setVow] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="wed-slip space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-2xl leading-snug">
            <em>{u.a.nickname}</em> te demande en mariage.
          </p>
          <p className="mt-1 font-body text-sm text-[#5a6070]">
            Le {shortDate(u.proposed_at)}, avec une alliance {metalLabel(u.ring).toLowerCase()}.
          </p>
        </div>
        <RingArt metal={u.ring} size={64} />
      </div>
      {u.vow_a && <blockquote className="livret-vow">« {u.vow_a} »</blockquote>}
      <div className="space-y-1">
        <label htmlFor={`rep-${u.id}`} className="block font-body text-sm text-[#5a6070]">
          Ta promesse en retour (facultatif, recopiée sur l&apos;acte)
        </label>
        <textarea id={`rep-${u.id}`} value={vow} onChange={(e) => setVow(e.target.value.slice(0, 600))} rows={3} className="field-dark" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onAnswer(true, vow.trim());
            setBusy(false);
          }}
          className="rounded-xl bg-[#5b1e2a] px-6 py-2.5 font-display text-lg tracking-wide text-[#f4e0a6] hover:bg-[#7a2a38] disabled:opacity-50"
        >
          Dire oui
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Décliner la demande de ${u.a.nickname} ?`)) return;
            setBusy(true);
            await onAnswer(false, "");
            setBusy(false);
          }}
          className="font-body text-sm text-[#5a6070] underline hover:no-underline"
        >
          Décliner
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Félicitations (dans le livret)
function Wishes({ u }: { u: Union }) {
  const list = u.wishes ?? [];
  if (list.length === 0) return <p className="livret-vow-by mt-8">Pas encore de félicitations.</p>;
  return (
    <div className="mt-8 space-y-2">
      <h3 className="livret-heading text-[0.95rem]">Félicitations</h3>
      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {list.map((w) => (
          <li key={w.user_id} className="font-body text-sm leading-snug">
            <span className="italic">« {w.message} »</span> <span className="text-[#5a6070]">{w.nickname}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Registre
function Registry({
  registry,
  me,
  admin,
  onWish,
  onRemoveWish,
  onAnnul,
}: {
  registry: Union[];
  me: Person;
  admin: boolean;
  onWish: (id: string, message: string) => Promise<boolean>;
  onRemoveWish: (id: string) => Promise<boolean>;
  onAnnul: (u: Union) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="space-y-4" aria-labelledby="registre-titre">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="registre-titre" className="font-display text-2xl tracking-wide">
          Le registre
        </h2>
        <p className="font-body text-sm text-paper/60">
          {registry.length === 0 ? "Aucune union pour l'instant." : `${registry.length} union${registry.length > 1 ? "s" : ""} en cours`}
        </p>
      </div>
      {registry.length === 0 ? (
        <p className="max-w-prose font-body text-paper/65">La première demande acceptée ouvrira le registre avec l&apos;acte n° 0001.</p>
      ) : (
        <ul>
          {registry.map((u) => {
            const mine = u.a.id === me.id || u.b.id === me.id;
            const isOpen = open === u.id;
            return (
              <li key={u.id} className="registre-row">
                <button type="button" className="registre-line" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : u.id)}>
                  <span className="registre-num">{acteNo(u.acte)}</span>
                  <span className="registre-avatars">
                    <Avatar p={u.a} />
                    <Avatar p={u.b} />
                  </span>
                  <span className="min-w-0">
                    <span className="registre-names block truncate">
                      {u.a.nickname} et {u.b.nickname}
                    </span>
                    <span className="registre-date">{u.married_at ? `unis le ${shortDate(u.married_at)}` : ""}</span>
                  </span>
                  <span className="registre-side flex items-center gap-3 font-body text-sm text-paper/60">
                    {u.wish_count > 0 && `${u.wish_count} mot${u.wish_count > 1 ? "s" : ""}`}
                    <RingArt metal={u.ring} size={30} gem={false} />
                  </span>
                </button>
                {isOpen && <RegistryDetail u={u} mine={mine} admin={admin} onWish={onWish} onRemoveWish={onRemoveWish} onAnnul={onAnnul} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RegistryDetail({
  u,
  mine,
  admin,
  onWish,
  onRemoveWish,
  onAnnul,
}: {
  u: Union;
  mine: boolean;
  admin: boolean;
  onWish: (id: string, message: string) => Promise<boolean>;
  onRemoveWish: (id: string) => Promise<boolean>;
  onAnnul: (u: Union) => void;
}) {
  const [msg, setMsg] = useState(u.my_wish ?? "");
  const [busy, setBusy] = useState(false);
  const wishes = u.wishes ?? [];
  return (
    <div className="grid gap-6 pb-6 pl-1 md:grid-cols-2 md:pl-[5.5rem]">
      <div className="space-y-3">
        {u.vow_a && (
          <figure>
            <blockquote className="font-body italic text-paper/85">« {u.vow_a} »</blockquote>
            <figcaption className="font-body text-sm text-paper/55">{u.a.nickname}</figcaption>
          </figure>
        )}
        {u.vow_b && (
          <figure>
            <blockquote className="font-body italic text-paper/85">« {u.vow_b} »</blockquote>
            <figcaption className="font-body text-sm text-paper/55">{u.b.nickname}</figcaption>
          </figure>
        )}
        {!u.vow_a && !u.vow_b && <p className="font-body text-sm text-paper/55">Pas de promesse écrite.</p>}
        {admin && (
          <button type="button" onClick={() => onAnnul(u)} className="font-mono text-[11px] text-paper/45 hover:text-red-light">
            Annuler cette union (administration)
          </button>
        )}
      </div>
      <div className="space-y-3">
        {wishes.length > 0 && (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {wishes.map((w) => (
              <li key={w.user_id} className="font-body text-sm">
                <span className="italic text-paper/85">« {w.message} »</span> <span className="text-paper/55">{w.nickname}</span>
              </li>
            ))}
          </ul>
        )}
        {!mine && (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!msg.trim()) return;
              setBusy(true);
              await onWish(u.id, msg.trim());
              setBusy(false);
            }}
          >
            <label htmlFor={`voeu-${u.id}`} className="block font-body text-sm text-paper/70">
              {u.my_wish ? "Ton mot pour les mariés" : `Un mot pour ${u.a.nickname} et ${u.b.nickname}`}
            </label>
            <textarea id={`voeu-${u.id}`} value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 280))} rows={2} className="field-dark" />
            <div className="flex items-center gap-4">
              <button type="submit" disabled={busy || !msg.trim()} className="rounded-lg border border-[#d8b46a]/70 px-4 py-1.5 font-body text-sm text-[#f4e0a6] hover:bg-[#d8b46a]/10 disabled:opacity-40">
                {u.my_wish ? "Modifier mon mot" : "Féliciter"}
              </button>
              {u.my_wish && (
                <button type="button" onClick={() => onRemoveWish(u.id)} className="font-body text-sm text-paper/50 underline hover:text-paper">
                  Retirer
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
