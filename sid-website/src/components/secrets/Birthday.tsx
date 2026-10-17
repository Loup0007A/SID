"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HIDDEN_BUTTON_EVENT } from "@/components/secrets/HiddenButton";

type GiftState = { birthday: boolean; already: boolean; amount: number };

/** 🎂 à côté du nom d'un membre, le jour de son anniversaire. */
export function BirthdayGift({ targetId, nickname }: { targetId: string; nickname: string }) {
  const supabase = createClient();
  const [state, setState] = useState<GiftState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("birthday_gift_state", { p_target: targetId }).then(({ data, error }) => {
      if (!error) setState(data as GiftState);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  if (!state?.birthday) return null;

  async function offer() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("offer_birthday_gift", { p_target: targetId });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setState((s) => (s ? { ...s, already: true } : s));
    setMsg(`🎉 ${nickname} a reçu tes 2 000 000 zénis. Quel cadeau !`);
    window.dispatchEvent(new Event(HIDDEN_BUTTON_EVENT));
  }

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="birthday-cake ml-2 text-xl"
        title={`C'est l'anniversaire de ${nickname} aujourd'hui !`}
        aria-label="Anniversaire"
      >
        🎂
      </button>
      {open && (
        <span className="absolute left-0 top-full z-20 mt-2 block w-72 space-y-2 rounded-lg border border-[#ffe08a]/40 bg-ink/95 p-3 text-left normal-case tracking-normal shadow-xl">
          <span className="block font-body text-sm text-paper">C&apos;est l&apos;anniversaire de {nickname} aujourd&apos;hui !</span>
          {state.already ? (
            <span className="block font-mono text-xs text-paper/60">Tu lui as déjà fait un cadeau cette année.</span>
          ) : (
            <>
              <span className="block font-body text-sm text-paper/80">Lui offrir 2 000 000 zénis ?</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={offer}
                  className="rounded-lg bg-gradient-to-r from-[#ffe08a] to-[#c98a1e] px-3 py-1 font-display text-xs uppercase text-ink disabled:opacity-40"
                >
                  {busy ? "…" : "🎁 Offrir"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="font-mono text-xs text-paper/60 underline">
                  Non merci
                </button>
              </span>
            </>
          )}
          {msg && <span className="block font-mono text-xs text-[#ffe08a]">{msg}</span>}
        </span>
      )}
    </span>
  );
}

/** Bandeau de l'accueil : qui fête son anniversaire aujourd'hui. */
export function BirthdaysToday({ myId }: { myId: string }) {
  const supabase = createClient();
  const [list, setList] = useState<{ user_id: string; nickname: string }[]>([]);
  useEffect(() => {
    supabase.rpc("birthdays_today").then(({ data, error }) => {
      if (!error) setList((data ?? []) as { user_id: string; nickname: string }[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (list.length === 0) return null;
  return (
    <div className="glass-card flex flex-wrap items-center gap-2 border-[#ffe08a]/30 px-4 py-3 font-body text-sm">
      <span className="text-xl" aria-hidden>🎂</span>
      <span className="text-paper/80">Anniversaire aujourd&apos;hui :</span>
      {list.map((b, i) => (
        <span key={b.user_id}>
          {b.user_id === myId ? (
            <span className="font-display uppercase text-[#ffe08a]">toi ! Joyeux anniversaire 🎉</span>
          ) : (
            <Link href={`/dashboard/profile/${b.user_id}`} className="font-display uppercase text-[#ffe08a] hover:underline">
              {b.nickname}
            </Link>
          )}
          {i < list.length - 1 ? "," : ""}
        </span>
      ))}
    </div>
  );
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Réglage de l'anniversaire (jour et mois seulement) dans « Mon dossier ». */
export function BirthdaySetting({ userId }: { userId: string }) {
  const supabase = createClient();
  const [day, setDay] = useState<number | "">("");
  const [month, setMonth] = useState<number | "">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase
      .from("member_birthdays")
      .select("day, month")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return;
        setReady(true);
        if (data) {
          setDay(data.day);
          setMonth(data.month);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!ready) return null;

  async function save() {
    setMsg(null);
    if (day === "" || month === "") {
      const { error } = await supabase.from("member_birthdays").delete().eq("user_id", userId);
      setMsg(error ? `Échec : ${error.message}` : "Anniversaire retiré.");
      return;
    }
    const { error } = await supabase.from("member_birthdays").upsert({ user_id: userId, day, month, updated_at: new Date().toISOString() });
    setMsg(error ? "Cette date n'existe pas." : "Anniversaire enregistré.");
  }

  const sel = "rounded-lg border border-paper-dark bg-paper px-2 py-2 font-body text-ink";

  return (
    <div className="glass-card space-y-3 p-6">
      <h2 className="font-display text-lg uppercase">Anniversaire</h2>
      <p className="font-body text-sm text-paper/70">
        Facultatif : le jour et le mois seulement. Les autres membres ne voient jamais la date, juste un 🎂 sur ton dossier le
        jour J.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={day} onChange={(e) => setDay(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Jour</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select className={sel} value={month} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Mois</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={save} className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light">
          Enregistrer
        </button>
      </div>
      {msg && <p className="font-mono text-xs text-red">{msg}</p>}
    </div>
  );
}
