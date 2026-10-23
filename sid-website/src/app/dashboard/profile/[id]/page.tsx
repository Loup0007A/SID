"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import type { Profile } from "@/types/database";
import { RankCard } from "@/components/RankCard";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import Link from "next/link";
import { loadCurrentUser, can } from "@/lib/permissions";
import { useEquippedTitles } from "@/lib/useEquippedTitles";
import { TitleAuraLayer, TitleBadge } from "@/components/titles/TitleVisuals";
import { BirthdayGift } from "@/components/lazy/Seals";

type VisibleProfile = Partial<Profile> & { id: string; nickname: string };
type MemberRole = { user_id: string; role_name: string; role_color: string; role_rank: number };

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<VisibleProfile | null | undefined>(undefined);
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [isSelf, setIsSelf] = useState(false);
  const [css, setCss] = useState<string>("");
  const [isStaff, setIsStaff] = useState(false);
  const [canTroll, setCanTroll] = useState(false);
  const titles = useEquippedTitles([params.id]);
  const title = titles.get(params.id);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await currentUser();
      if (!user) return;

      if (user.id === params.id) {
        setIsSelf(true);
        router.replace("/dashboard/profile");
        return;
      }

      // Tout part en même temps (un seul aller-retour).
      const [{ profile: me, permissions }, { data }, { data: rolesData }, { data: styleRows }] = await Promise.all([
        loadCurrentUser(),
        supabase.rpc("get_visible_profile", { target: params.id, viewer: user.id }),
        supabase.rpc("list_member_roles"),
        supabase.rpc("get_profile_css_for", { p_section: "profile", p_user_ids: [params.id] }),
      ]);
      setIsStaff(can(permissions, "manage_users"));
      setCanTroll(!!me?.equipped_title);
      setProfile((data as VisibleProfile) ?? null);
      setRoles(((rolesData ?? []) as MemberRole[]).filter((r) => r.user_id === params.id));
      const row = ((styleRows ?? []) as { user_id: string; css: string }[])[0];
      setCss(row?.css ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (isSelf) return null;
  if (profile === undefined) return <p className="font-body text-paper/60">Chargement du dossier…</p>;
  if (profile === null) return <p className="font-body text-paper/60">Ce dossier est introuvable ou inaccessible.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Le CSS personnalisé ne s'applique qu'à cette carte-ci (comme pour
          l'organigramme, le trombinoscope et le classement) — pas à toute
          la page, ni à la description en dessous. */}
      <div className={`glass-card relative flex flex-wrap items-center gap-4 overflow-hidden p-6 ${title ? "min-h-[150px]" : ""} ${profileSkinClass(profile.id)}`}>
        <ProfileStyle userId={profile.id} css={css} />
        {title && <TitleAuraLayer titleId={title.title_id} dragon={title.dragon} />}
        <div className="relative z-[1]">
          <RankCard rank={profile.member_rank ?? "E"} />
        </div>
        <div className="relative z-[1] min-w-0 flex-1">
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">
            {profile.nickname}
            <BirthdayGift targetId={profile.id} nickname={profile.nickname} />
          </h1>
          {title && (
            <div className="my-1">
              <TitleBadge titleId={title.title_id} level={title.level} dragon={title.dragon} size="md" />
            </div>
          )}
          {canTroll && (
            <Link href={`/dashboard/titles?target=${profile.id}`} className="mr-3 font-mono text-xs uppercase text-[#ffb15c] underline">
              🎭 Lui faire une farce
            </Link>
          )}
          {isStaff && (
            <Link href={`/dashboard/admin/members/${profile.id}`} className="font-mono text-xs uppercase text-blue-light underline">
              Fiche d&apos;administration →
            </Link>
          )}
          {profile.is_invisible && (
            <p className="font-mono text-xs text-paper/50">👻 Compte invisible : les autres membres ne voient pas ce dossier.</p>
          )}
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
