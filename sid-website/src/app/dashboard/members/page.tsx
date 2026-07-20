"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

type RosterEntry = Partial<Profile> & { id: string; nickname: string };
type MemberRole = { user_id: string; role_name: string; role_color: string; role_rank: number };

export default function MembersPage() {
  const supabase = createClient();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Map<string, MemberRole[]>>(new Map());

  useEffect(() => {
    (async () => {
      const [{ data: rosterData }, { data: rolesData }] = await Promise.all([
        supabase.rpc("list_roster"),
        supabase.rpc("list_member_roles"),
      ]);

      // Filtre défensif : on ignore toute entrée null (ne devrait plus
      // arriver depuis le correctif de list_roster, mais ceinture + bretelles).
      setRoster(((rosterData ?? []) as (RosterEntry | null)[]).filter((m): m is RosterEntry => m !== null));

      const map = new Map<string, MemberRole[]>();
      ((rolesData ?? []) as MemberRole[]).forEach((r) => {
        const list = map.get(r.user_id) ?? [];
        list.push(r);
        map.set(r.user_id, list);
      });
      setRolesByUser(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Trombinoscope</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((m) => {
          const roles = rolesByUser.get(m.id) ?? [];
          return (
            <div key={m.id} className="dossier-card space-y-1 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-lg uppercase">{m.nickname}</p>
                {m.age !== undefined && m.age !== null && (
                  <span className="font-mono text-xs text-paper-text/60">{m.age} ans</span>
                )}
              </div>

              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <span
                      key={r.role_name}
                      className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
                      style={{ borderColor: r.role_color, color: r.role_color }}
                    >
                      {r.role_name}
                    </span>
                  ))}
                </div>
              )}

              {(m.first_name || m.last_name) && (
                <p className="font-mono text-xs text-paper-text/60">{[m.first_name, m.last_name].filter(Boolean).join(" ")}</p>
              )}
              {m.desired_role && <p className="font-mono text-xs text-paper-text/60">Rôle souhaité : {m.desired_role}</p>}
              {m.weapons && <p className="font-body text-sm">🗡 {m.weapons}</p>}
              {m.equipment && <p className="font-body text-sm">🎒 {m.equipment}</p>}
              {m.description && <p className="mt-1 font-body text-sm text-paper-text/80">{m.description}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
