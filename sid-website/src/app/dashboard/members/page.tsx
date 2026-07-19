"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

type RosterEntry = Partial<Profile> & { id: string; nickname: string };

export default function MembersPage() {
  const supabase = createClient();
  const [roster, setRoster] = useState<RosterEntry[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_roster");
      setRoster((data ?? []) as RosterEntry[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Trombinoscope</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((m) => (
          <div key={m.id} className="dossier-card space-y-1 p-4">
            <p className="font-display text-lg uppercase">{m.nickname}</p>
            {(m.first_name || m.last_name) && (
              <p className="font-mono text-xs text-paper-text/60">{[m.first_name, m.last_name].filter(Boolean).join(" ")}</p>
            )}
            {m.age !== undefined && m.age !== null && <p className="font-mono text-xs text-paper-text/60">Âge : {m.age}</p>}
            {m.desired_role && <p className="font-mono text-xs text-paper-text/60">Rôle : {m.desired_role}</p>}
            {m.weapons && <p className="font-body text-sm">🗡 {m.weapons}</p>}
            {m.equipment && <p className="font-body text-sm">🎒 {m.equipment}</p>}
            {m.description && <p className="mt-1 font-body text-sm text-paper-text/80">{m.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
