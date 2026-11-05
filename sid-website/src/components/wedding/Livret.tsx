"use client";

import "./wedding.css";

/** Le livret d'union (Lot 66) : couverture, alliances et acte. */

export type Metal = "or" | "argent" | "rose" | "ebene";
export type Person = { id: string; nickname: string; avatar_url: string | null };
export type Wish = { user_id: string; nickname: string; avatar_url: string | null; message: string; at: string };
export type Union = {
  id: string;
  status: "proposed" | "married" | "declined" | "cancelled" | "divorced" | "annulled";
  ring: Metal;
  a: Person;
  b: Person;
  vow_a: string | null;
  vow_b: string | null;
  proposed_at: string;
  married_at: string | null;
  acte: number | null;
  wish_count: number;
  my_wish: string | null;
  wishes: Wish[] | null;
};

export const METALS: { key: Metal; label: string }[] = [
  { key: "or", label: "Or jaune" },
  { key: "argent", label: "Argent" },
  { key: "rose", label: "Or rose" },
  { key: "ebene", label: "Ébène et or" },
];
export const metalLabel = (m: Metal) => METALS.find((x) => x.key === m)?.label ?? "Or jaune";

const STOPS: Record<Metal, [string, string, string]> = {
  or: ["#f7e6a8", "#c3913a", "#f2d27c"],
  argent: ["#f7f9fb", "#959eaa", "#e2e7ed"],
  rose: ["#f8d6c4", "#bb7660", "#f1bba2"],
  ebene: ["#55555e", "#101015", "#3d3d46"],
};

/** Une alliance vue de trois quarts. */
export function RingArt({ metal, size = 64, gem = true }: { metal: Metal; size?: number; gem?: boolean }) {
  const [a, b, c] = STOPS[metal];
  const id = `ring-${metal}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="0.55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="38" rx="22" ry="17" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="9" transform="translate(1.5 2)" />
      <ellipse cx="32" cy="38" rx="22" ry="17" fill="none" stroke={`url(#${id})`} strokeWidth="8" />
      <ellipse cx="32" cy="38" rx="22" ry="17" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeDasharray="18 120" strokeDashoffset="-6" />
      {metal === "ebene" && <ellipse cx="32" cy="38" rx="18.5" ry="13.6" fill="none" stroke="#d8b46a" strokeWidth="1.1" />}
      {gem && metal !== "ebene" && (
        <>
          <path d="M25 19l7-8 7 8-7 6z" fill="#cfeefc" stroke="rgba(30,40,60,0.55)" strokeWidth="1" />
          <path d="M25 19h14M32 11l-3 8 3 6 3-6z" fill="none" stroke="rgba(30,40,60,0.35)" strokeWidth="0.8" />
          <path d="M28 21l-1.5-1.5 1-1.5 2 2z" fill="#fff" />
        </>
      )}
    </svg>
  );
}

/** Deux alliances entrelacées, au fer doré (couverture). */
function Emblem() {
  return (
    <svg viewBox="0 0 120 80" width="58%" aria-hidden className="relative">
      <g fill="none" stroke="currentColor" strokeWidth="3.2">
        <circle cx="46" cy="44" r="24" />
        <circle cx="74" cy="44" r="24" />
      </g>
      {/* Le cercle de gauche repasse devant celui de droite, en bas : les alliances s'entrelacent. */}
      <path d="M64.4 59.4A24 24 0 0 1 54.2 66.6" fill="none" stroke="#5b1e2a" strokeWidth="8" />
      <path d="M64.4 59.4A24 24 0 0 1 54.2 66.6" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="M41 14l5-7 5 7-5 5z" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1" opacity="0.7">
        <path d="M14 44h6M100 44h6M10 40l4 4-4 4M110 40l-4 4 4 4" fill="none" />
      </g>
    </svg>
  );
}

export function LivretCover({ shine = false }: { shine?: boolean }) {
  return (
    <div className="livret-cover" role="img" aria-label="Livret d'union du S.I.D.">
      <p className={`livret-cover-title wed-foil ${shine ? "is-shining" : ""}`}>
        LIVRET
        <br />
        D&apos;UNION
      </p>
      <Emblem />
      <p className={`livret-cover-sub wed-foil ${shine ? "is-shining" : ""}`}>Service de l&apos;état civil du S.I.D.</p>
    </div>
  );
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
export const acteNo = (n: number | null) => (n == null ? "" : `n° ${String(n).padStart(4, "0")}`);

function Portrait({ p }: { p: Person }) {
  return (
    <span className="livret-portrait">
      {p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt="" />
      ) : (
        p.nickname.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** L'acte, sur la double page du livret. `opening` : la couverture s'ouvre. */
export function LivretSpread({ u, opening = false, children }: { u: Union; opening?: boolean; children?: React.ReactNode }) {
  const days = u.married_at ? daysSince(u.married_at) : 0;
  return (
    <div className="livret-book">
      <article className="livret-spread" aria-label={`Acte d'union ${acteNo(u.acte)} entre ${u.a.nickname} et ${u.b.nickname}`}>
        <div className="livret-page">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="livret-heading">Acte d&apos;union</h2>
            <span className="livret-acte">{acteNo(u.acte)}</span>
          </div>
          <div className="livret-portraits">
            <Portrait p={u.a} />
            <RingArt metal={u.ring} size={46} gem={false} />
            <Portrait p={u.b} />
          </div>
          <dl>
            <div className="livret-field">
              <dt>Entre</dt>
              <dd>{u.a.nickname}</dd>
            </div>
            <div className="livret-field">
              <dt>et</dt>
              <dd>{u.b.nickname}</dd>
            </div>
            {u.married_at && (
              <div className="livret-field">
                <dt>Célébrée le</dt>
                <dd>{longDate(u.married_at)}</dd>
              </div>
            )}
            <div className="livret-field">
              <dt>Alliance</dt>
              <dd>{metalLabel(u.ring)}</dd>
            </div>
            {u.married_at && (
              <div className="livret-field">
                <dt>Depuis</dt>
                <dd>{days === 0 ? "aujourd'hui" : days === 1 ? "un jour" : `${days.toLocaleString("fr-FR")} jours`}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="livret-page has-stamp">
          <h2 className="livret-heading">Promesses</h2>
          <div className="mt-4 space-y-5">
            {u.vow_a || u.vow_b ? (
              <>
                {u.vow_a && (
                  <figure>
                    <blockquote className="livret-vow">« {u.vow_a} »</blockquote>
                    <figcaption className="livret-vow-by mt-1">{u.a.nickname}</figcaption>
                  </figure>
                )}
                {u.vow_b && (
                  <figure>
                    <blockquote className="livret-vow">« {u.vow_b} »</blockquote>
                    <figcaption className="livret-vow-by mt-1">{u.b.nickname}</figcaption>
                  </figure>
                )}
              </>
            ) : (
              <p className="livret-vow-by">Pas de promesse écrite.</p>
            )}
          </div>
          {children}
          <div className="livret-stamp" aria-hidden>
            <b>S.I.D.</b>
            <span>
              État civil
              <br />
              {u.married_at ? new Date(u.married_at).toLocaleDateString("fr-FR") : ""}
            </span>
          </div>
        </div>
      </article>
      {opening && (
        <div className="livret-flap" aria-hidden>
          <LivretCover />
        </div>
      )}
    </div>
  );
}
