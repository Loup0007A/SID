"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_CSS_SECTIONS, DEFAULT_PROFILE_CSS, AVAILABLE_CLASSES } from "@/types/profileStyle";
import type { ProfileCssSection, ProfileStyleRow } from "@/types/profileStyle";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import { RankCard } from "@/components/RankCard";
import { labelClass } from "@/lib/ui";

export default function SettingsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("Ton pseudo");
  // "saved" = ce qui est réellement en base (vide tant que rien n'a été
  // enregistré) ; "drafts" = ce qui est affiché dans le champ, pré-rempli
  // avec un exemple basique modifiable tant que rien n'a encore été
  // enregistré pour cette section.
  const [drafts, setDrafts] = useState<Record<ProfileCssSection, string>>({ ...DEFAULT_PROFILE_CSS });
  const [saved, setSaved] = useState<Record<ProfileCssSection, string>>({
    org_chart: "",
    roster: "",
    leaderboard: "",
    profile: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<ProfileCssSection | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profileRow } = await supabase.from("profiles").select("nickname").eq("id", user.id).single();
      if (profileRow?.nickname) setNickname(profileRow.nickname);

      const { data } = await supabase.rpc("get_my_profile_css");
      const rows = (data ?? []) as ProfileStyleRow[];
      const savedNext = { org_chart: "", roster: "", leaderboard: "", profile: "" } as Record<ProfileCssSection, string>;
      rows.forEach((r) => {
        savedNext[r.section] = r.css;
      });
      setSaved(savedNext);
      // Le champ affiche ce qui est déjà enregistré ; sinon, un exemple de
      // départ que l'utilisateur peut modifier ou vider librement.
      setDrafts({
        org_chart: savedNext.org_chart || DEFAULT_PROFILE_CSS.org_chart,
        roster: savedNext.roster || DEFAULT_PROFILE_CSS.roster,
        leaderboard: savedNext.leaderboard || DEFAULT_PROFILE_CSS.leaderboard,
        profile: savedNext.profile || DEFAULT_PROFILE_CSS.profile,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(section: ProfileCssSection) {
    setSavingSection(section);
    setMessage(null);
    const { error } = await supabase.rpc("set_profile_css", { p_section: section, p_css: drafts[section] });
    setSavingSection(null);
    if (error) {
      setMessage(`Échec (${PROFILE_CSS_SECTIONS.find((s) => s.key === section)?.label}) : ${error.message}`);
      return;
    }
    setSaved((s) => ({ ...s, [section]: drafts[section] }));
    setMessage(`Enregistré pour « ${PROFILE_CSS_SECTIONS.find((s) => s.key === section)?.label} ».`);
  }

  async function resetSection(section: ProfileCssSection) {
    if (!confirm("Vider le CSS de cette section ? (repart sur l'exemple de base, non enregistré)")) return;
    setSavingSection(section);
    const { error } = await supabase.rpc("reset_profile_css", { p_section: section });
    setSavingSection(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setDrafts((d) => ({ ...d, [section]: DEFAULT_PROFILE_CSS[section] }));
    setSaved((s) => ({ ...s, [section]: "" }));
  }

  if (!userId) return <p className="font-body text-paper/60">Chargement…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Réglages</h1>

      <section className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Apparence personnalisée</h2>
        <p className="font-body text-sm text-paper/70">
          Du CSS pour chacune des 4 zones où les autres membres te voient. Un champ pré-rempli avec un exemple, à
          modifier ou étoffer comme tu veux — les propriétés tapées SANS sélecteur (comme dans l&apos;exemple)
          s&apos;appliquent directement à ta carte ; ajoute des blocs <code>.classe {"{"} ... {"}"}</code> pour cibler
          un élément précis à l&apos;intérieur.
        </p>
        <p className="font-body text-sm text-paper/70">
          Le CSS ne peut s&apos;appliquer qu&apos;à ta propre carte/ligne/fiche — impossible de toucher au reste de la
          page. Certaines constructions sont refusées ou retirées automatiquement (<code>url()</code>,{" "}
          <code>@import</code>, <code>position: fixed</code>, etc.), 8000 caractères maximum par section. Les noms de
          classe sont automatiquement remis en minuscules (<code>.RANK-CARD-LETTER</code> devient{" "}
          <code>.rank-card-letter</code>) au cas où — mais écris-les en minuscules directement pour ne pas avoir de
          mauvaise surprise ailleurs.
        </p>
        {message && <p className="font-mono text-sm text-red">{message}</p>}
      </section>

      {PROFILE_CSS_SECTIONS.map(({ key, label, hint }) => {
        return (
          <section key={key} className="glass-card space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base uppercase text-blue-light">{label}</h3>
                <p className="font-mono text-xs text-paper/50">{hint}</p>
              </div>
              <span className="font-mono text-[10px] text-paper/40">{drafts[key].length} / 8000</span>
            </div>

            <details className="font-mono text-[10px] text-paper/50">
              <summary className="cursor-pointer uppercase text-paper/60 hover:text-blue-light">Classes disponibles ici</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {AVAILABLE_CLASSES[key].map((c) => (
                  <li key={c.className}>
                    <code>.{c.className}</code> — {c.hint}
                  </li>
                ))}
              </ul>
            </details>

            <textarea
              rows={9}
              spellCheck={false}
              className={`${labelClass} w-full rounded-lg border border-paper-dark bg-ink-soft px-3 py-2 font-mono text-xs text-paper outline-none transition focus:border-blue`}
              value={drafts[key]}
              maxLength={8000}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => save(key)}
                disabled={savingSection === key}
                className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingSection === key ? "Enregistrement…" : "Enregistrer"}
              </button>
              {saved[key] && (
                <button
                  onClick={() => resetSection(key)}
                  disabled={savingSection === key}
                  className="rounded-lg border border-red px-4 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
                >
                  Vider
                </button>
              )}
            </div>

            {/* Aperçu en direct : reprend le balisage réel de la zone concernée */}
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase text-paper/40">Aperçu</p>
              <SectionPreview section={key} userId={userId} nickname={nickname} css={drafts[key]} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SectionPreview({ section, userId, nickname, css }: { section: ProfileCssSection; userId: string; nickname: string; css: string }) {
  const skin = profileSkinClass(userId);

  if (section === "org_chart") {
    return (
      <div className={`glass-card inline-flex flex-col gap-1 px-4 py-2 ${skin}`}>
        <ProfileStyle userId={userId} css={css} />
        <span className="font-display uppercase tracking-wide">Poste occupé</span>
        <span className="font-mono text-xs text-paper/70">{nickname}</span>
      </div>
    );
  }

  if (section === "roster") {
    return (
      <div className={`glass-card max-w-xs space-y-1 p-4 ${skin}`}>
        <ProfileStyle userId={userId} css={css} />
        <span className="font-display text-lg uppercase">{nickname}</span>
        <p className="font-mono text-xs text-paper/60">Agent de terrain</p>
        <p className="font-body text-sm text-paper/80">Un aperçu de ta carte du trombinoscope.</p>
      </div>
    );
  }

  if (section === "leaderboard") {
    return (
      <div className={`glass-card flex items-center gap-4 px-4 py-3 ${skin}`}>
        <ProfileStyle userId={userId} css={css} />
        <span className="w-8 shrink-0 text-center font-display text-lg text-blue-light">1</span>
        <span className="flex-1 font-display uppercase">{nickname}</span>
        <span className="font-mono text-sm text-blue-light">1 234 pts</span>
      </div>
    );
  }

  return (
    <div className={`glass-card flex flex-wrap items-center gap-4 p-6 ${skin}`}>
      <ProfileStyle userId={userId} css={css} />
      <RankCard rank="B" />
      <div>
        <p className="font-display text-2xl uppercase tracking-wide text-red">{nickname}</p>
        <p className="font-mono text-xs text-paper/60">Aperçu de ta fiche de profil</p>
      </div>
    </div>
  );
}
