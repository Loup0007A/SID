"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, QuestDifficulty } from "@/types/database";
import { RankCard } from "@/components/RankCard";

type VisibleProfile = Partial<Profile> & { id: string; nickname: string };
type MemberRole = { user_id: string; role_name: string; role_color: string; role_rank: number };

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<VisibleProfile | null | undefined>(undefined);
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (user.id === params.id) {
        setIsSelf(true);
        router.replace("/dashboard/profile");
        return;
      }

      const { data } = await supabase.rpc("get_visible_profile", { target: params.id, viewer: user.id });
      setProfile((data as VisibleProfile) ?? null);

      const { data: rolesData } = await supabase.rpc("list_member_roles");
      setRoles(((rolesData ?? []) as MemberRole[]).filter((r) => r.user_id === params.id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (isSelf) return null;
  if (profile === undefined) return <p className="font-body text-paper/60">Chargement du dossier…</p>;
  if (profile === null) return <p className="font-body text-paper/60">Ce dossier est introuvable ou inaccessible.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <RankCard rank={(profile.member_rank as QuestDifficulty) ?? "E"} />
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">{profile.nickname}</h1>
          {(profile.first_name || profile.last_name) && (
            <p className="font-mono text-xs text-paper/60">{[profile.first_name, profile.last_name].filter(Boolean).join(" ")}</p>
          )}
          {roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
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
        </div>
      </div>

      <div className="glass-card space-y-2 p-6">
        {profile.age !== undefined && profile.age !== null && <p className="font-mono text-xs text-paper/60">Âge : {profile.age}</p>}
        {profile.desired_role && <p className="font-mono text-xs text-paper/60">Rôle : {profile.desired_role}</p>}
        {profile.weapons && <p className="font-body text-sm">🗡 {profile.weapons}</p>}
        {profile.equipment && <p className="font-body text-sm">🎒 {profile.equipment}</p>}
        {profile.description && <p className="mt-2 font-body text-sm text-paper/80">{profile.description}</p>}
      </div>
    </div>
  );
}
