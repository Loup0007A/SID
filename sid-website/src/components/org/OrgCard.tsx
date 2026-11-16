import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import { SidIcon } from "@/components/icons/SidIcon";
import type { OrgHolder, OrgTeam } from "@/lib/orgChart";

/**
 * Carte d'un poste de l'organigramme (Lot 83). Le CSS personnalisé du
 * titulaire (Réglages → Organigramme) s'applique à la carte entière.
 * Classes utiles pour ce CSS : org-card-title, org-card-holder,
 * org-card-mission, org-card-team.
 */
export function OrgCard({
  id,
  label,
  description,
  holder,
  team,
  css,
  isMe = false,
  linkHolder = true,
  className = "",
  children,
}: {
  id?: string;
  label: string;
  description?: string | null;
  holder: OrgHolder | null;
  team?: OrgTeam | null;
  css?: string | null;
  isMe?: boolean;
  linkHolder?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const skin = holder ? profileSkinClass(holder.id) : "";
  const initials = holder ? holder.nickname.slice(0, 2).toUpperCase() : "";
  return (
    <div id={id} className={`org-card glass-card ${holder ? "" : "is-vacant"} ${isMe ? "is-me" : ""} ${skin} ${className}`.replace(/\s+/g, " ").trim()}>
      {holder && <ProfileStyle userId={holder.id} css={css} />}
      <div className="org-card-head">
        <span className="org-card-title font-display">{label}</span>
        {isMe && <span className="org-card-me">Toi</span>}
      </div>
      <div className="org-card-holder">
        {holder ? (
          <>
            {holder.avatar_url ? (
              <img src={holder.avatar_url} alt="" className="org-card-avatar" loading="lazy" />
            ) : (
              <span className="org-card-avatar is-initials" aria-hidden>
                {initials}
              </span>
            )}
            {linkHolder ? (
              <Link href={`/dashboard/profile/${holder.id}`} className="org-card-name">
                {holder.nickname}
              </Link>
            ) : (
              <span className="org-card-name">{holder.nickname}</span>
            )}
          </>
        ) : (
          <>
            <span className="org-card-avatar is-vacant" aria-hidden>
              <SidIcon name="profile" />
            </span>
            <span className="org-card-name is-vacant">Poste vacant</span>
          </>
        )}
      </div>
      {description && <p className="org-card-mission">{description}</p>}
      {team && (
        <p className="org-card-team">
          <span>{team.name}</span>
          {team.independent && <span className="org-card-indep">Système indépendant</span>}
        </p>
      )}
      {children}
    </div>
  );
}
