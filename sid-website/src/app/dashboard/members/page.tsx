"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import { useEquippedTitles } from "@/lib/useEquippedTitles";
import { TitleAuraLayer, TitleBadge } from "@/components/titles/TitleVisuals";
import { SidIcon } from "@/components/icons/SidIcon";

type RosterEntry = Partial<Profile> & { id: string; nickname: string };
type MemberRole = { user_id: string; role_name: string; role_color: string; role_rank: number };

export default function MembersPage() {
  const supabase = createClient();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Map<string, MemberRole[]>>(new Map());
  const [styles, setStyles] = useState<Map<string, string>>(new Map());
  const titles = useEquippedTitles(roster.map((m) => m.id));

  useEffect(() => {
    (async () => {
      const [{ data: rosterData }, { data: rolesData }] = await Promise.all([
        supabase.rpc("list_roster"),
        supabase.rpc("list_member_roles"),
      ]);

      // Filtre défensif : on ignore toute entrée null (ne devrait plus
      // arriver depuis le correctif de list_roster, mais ceinture + bretelles).
      const cleaned = ((rosterData ?? []) as (RosterEntry | null)[]).filter((m): m is RosterEntry => m !== null);
      setRoster(cleaned);

      const map = new Map<string, MemberRole[]>();
      ((rolesData ?? []) as MemberRole[]).forEach((r) => {
        const list = map.get(r.user_id) ?? [];
        list.push(r);
        map.set(r.user_id, list);
      });
      setRolesByUser(map);

      const ids = cleaned.map((m) => m.id);
      if (ids.length > 0) {
        const { data: css } = await supabase.rpc("get_profile_css_for", { p_section: "roster", p_user_ids: ids });
        setStyles(new Map(((css ?? []) as { user_id: string; css: string }[]).map((r) => [r.user_id, r.css])));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Trombinoscope</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((m) => {
          const roles = rolesByUser.get(m.id) ?? [];
          const title = titles.get(m.id);
          return (
            <div key={m.id} className={`glass-card relative space-y-1 overflow-hidden p-4 ${profileSkinClass(m.id)}`}>
              <ProfileStyle userId={m.id} css={styles.get(m.id)} />
              {title && <TitleAuraLayer titleId={title.title_id} dragon={title.dragon} compact />}
              <div className="relative z-[1] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/dashboard/profile/${m.id}`} className="font-display text-lg uppercase hover:text-blue-light hover:underline">
                  {m.nickname}
                  {m.is_invisible && (
                    <span className="ml-2 align-middle font-mono text-[10px] normal-case text-paper/50" title="Compte invisible : seuls le membre et l'administration le voient ici">
                      <SidIcon name="ghost" /> invisible
                    </span>
                  )}
                </Link>
                {m.age !== undefined && m.age !== null && (
                  <span className="font-mono text-xs text-paper/60">{m.age} ans</span>
                )}
              </div>

              {title && <TitleBadge titleId={title.title_id} level={title.level} dragon={title.dragon} size="xs" />}

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
                <p className="font-mono text-xs text-paper/60">{[m.first_name, m.last_name].filter(Boolean).join(" ")}</p>
              )}
              {m.desired_role && <p className="font-mono text-xs text-paper/60">Rôle souhaité : {m.desired_role}</p>}
              {m.weapons && <p className="font-body text-sm"><SidIcon name="dagger" /> {m.weapons}</p>}
              {m.equipment && <p className="font-body text-sm"><SidIcon name="backpack" /> {m.equipment}</p>}
              {m.description && <p className="mt-1 font-body text-sm text-paper/80">{m.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
