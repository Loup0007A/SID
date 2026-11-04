"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PollCard, type Poll } from "@/components/polls/PollCard";

/** Accueil (Lot 65) : le sondage ouvert auquel le membre n'a pas encore répondu. */
export function PollSpotlight() {
  const supabase = useMemo(() => createClient(), []);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [others, setOthers] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("polls_list", { p_limit: 10 });
    const todo = ((data ?? []) as Poll[]).filter((p) => p.is_open && !p.voted);
    // Après un vote, on garde la carte affichée avec les résultats.
    setPoll((cur) => (cur ? ((data ?? []) as Poll[]).find((p) => p.id === cur.id) ?? todo[0] ?? null : todo[0] ?? null));
    setOthers(Math.max(0, todo.length - 1));
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (!poll) return null;
  return (
    <section aria-label="Sondage en cours" className="space-y-2">
      <PollCard poll={poll} compact onChanged={load} />
      <Link href="/dashboard/polls" scroll={false} className="inline-block font-mono text-xs uppercase text-blue underline">
        {others > 0 ? `${others} autre${others > 1 ? "s" : ""} sondage${others > 1 ? "s" : ""} en attente →` : "Tous les sondages →"}
      </Link>
    </section>
  );
}
