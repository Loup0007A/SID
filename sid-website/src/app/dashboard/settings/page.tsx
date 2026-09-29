"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_CSS_SECTIONS } from "@/types/profileStyle";
import type { ProfileCssSection, ProfileStyleRow } from "@/types/profileStyle";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import { CssBuilderPanel } from "@/components/CssBuilderPanel";
import { RankCard } from "@/components/RankCard";
import { labelClass } from "@/lib/ui";
import {
  buildCss,
  parseBuilderOptions,
  defaultBuilderOptions,
  accentSelectorFor,
  type CssBuilderOptions,
} from "@/lib/profileCssBuilder";
import clsx from "clsx";

const ACCENT_LABEL: Record<ProfileCssSection, string> = {
  org_chart: "titre du poste",
  roster: "ton pseudo",
  leaderboard: "ton pseudo",
  profile: "la grande lettre de rang",
};

type Mode = "visual" | "advanced";

export default function SettingsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("Ton pseudo");

  const [mode, setMode] = useState<Record<ProfileCssSection, Mode>>({
    org_chart: "visual",
    roster: "visual",
    leaderboard: "visual",
    profile: "visual",
  });
  const [options, setOptions] = useState<Record<ProfileCssSection, CssBuilderOptions>>({
    org_chart: defaultBuilderOptions("#8fb3d9"),
    roster: defaultBuilderOptions("#d99a9a"),
    leaderboard: defaultBuilderOptions("#8fb3d9"),
    profile: defaultBuilderOptions("#d4af37"),
  });
  const [rawDrafts, setRawDrafts] = useState<Record<ProfileCssSection, string>>({
    org_chart: "",
    roster: "",
    leaderboard: "",
    profile: "",
  });
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

      setOptions((o) => {
        const next = { ...o };
        (Object.keys(next) as ProfileCssSection[]).forEach((s) => {
          const parsed = parseBuilderOptions(savedNext[s]);
          if (parsed) next[s] = parsed;
        });
        return next;
      });
      setMode((m) => {
        const next = { ...m };
        (Object.keys(next) as ProfileCssSection[]).forEach((s) => {
          // Si du CSS existe mais qu'il n'a pas été généré par l'éditeur
          // visuel (pas de commentaire BUILDER reconnu), on ouvre plutôt le
          // mode avancé pour ne rien écraser par surprise.
          if (savedNext[s] && !parseBuilderOptions(savedNext[s])) next[s] = "advanced";
        });
        return next;
      });
      setRawDrafts(savedNext);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(section: ProfileCssSection, next: Mode) {
    if (next === "visual" && mode[section] === "advanced" && rawDrafts[section] && !parseBuilderOptions(rawDrafts[section])) {
      if (!confirm("Passer à l'éditeur visuel remplacera ton CSS avancé actuel par les réglages ci-dessous. Continuer ?")) return;
    }
    setMode((m) => ({ ...m, [section]: next }));
  }

  async function saveVisual(section: ProfileCssSection) {
    const css = buildCss(section, options[section]);
    setSavingSection(section);
    setMessage(null);
    const { error } = await supabase.rpc("set_profile_css", { p_section: section, p_css: css });
    setSavingSection(null);
    if (error) {
      setMessage(`Échec (${PROFILE_CSS_SECTIONS.find((s) => s.key === section)?.label}) : ${error.message}`);
      return;
    }
    setSaved((s) => ({ ...s, [section]: css }));
    setRawDrafts((d) => ({ ...d, [section]: css }));
    setMessage(`Enregistré pour « ${PROFILE_CSS_SECTIONS.find((s) => s.key === section)?.label} ».`);
  }

  async function saveAdvanced(section: ProfileCssSection) {
    setSavingSection(section);
    setMessage(null);
    const { error } = await supabase.rpc("set_profile_css", { p_section: section, p_css: rawDrafts[section] });
    setSavingSection(null);
    if (error) {
      setMessage(`Échec (${PROFILE_CSS_SECTIONS.find((s) => s.key === section)?.label}) : ${error.message}`);
      return;
    }
    setSaved((s) => ({ ...s, [section]: rawDrafts[section] }));
    setMessage(`Enregistré pour « ${PROFILE_CSS_SECTIONS.find((s) => s.key === section)?.label} ».`);
  }

  async function resetSection(section: ProfileCssSection) {
    if (!confirm("Retirer complètement le style personnalisé de cette section ?")) return;
    setSavingSection(section);
    const { error } = await supabase.rpc("reset_profile_css", { p_section: section });
    setSavingSection(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setSaved((s) => ({ ...s, [section]: "" }));
    setRawDrafts((d) => ({ ...d, [section]: "" }));
  }

  if (!userId) return <p className="font-body text-paper/60">Chargement…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Réglages</h1>

      <section className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Apparence personnalisée</h2>
        <p className="font-body text-sm text-paper/70">
          Couleurs, bordure, lueur et animations pour chacune des 4 zones où les autres membres te voient — aucun code
          à écrire. Le résultat ne peut s&apos;appliquer qu&apos;à ta propre carte/ligne/fiche, jamais au reste de la
          page.
        </p>
        {message && <p className="font-mono text-sm text-red">{message}</p>}
      </section>

      {PROFILE_CSS_SECTIONS.map(({ key, label, hint }) => {
        const currentMode = mode[key];
        const previewCss = currentMode === "visual" ? buildCss(key, options[key]) : rawDrafts[key];
        return (
          <section key={key} className="glass-card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base uppercase text-blue-light">{label}</h3>
                <p className="font-mono text-xs text-paper/50">{hint}</p>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-white/15">
                <button
                  onClick={() => switchMode(key, "visual")}
                  className={clsx("px-3 py-1.5 font-mono text-[10px] uppercase", currentMode === "visual" ? "bg-blue text-ink" : "text-paper/60 hover:text-paper")}
                >
                  Éditeur visuel
                </button>
                <button
                  onClick={() => switchMode(key, "advanced")}
                  className={clsx("px-3 py-1.5 font-mono text-[10px] uppercase", currentMode === "advanced" ? "bg-blue text-ink" : "text-paper/60 hover:text-paper")}
                >
                  CSS avancé
                </button>
              </div>
            </div>

            {currentMode === "visual" ? (
              <>
                <CssBuilderPanel
                  accentLabel={ACCENT_LABEL[key]}
                  options={options[key]}
                  onChange={(next) => setOptions((o) => ({ ...o, [key]: next }))}
                />
                <button
                  onClick={() => saveVisual(key)}
                  disabled={savingSection === key}
                  className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingSection === key ? "Enregistrement…" : "Enregistrer"}
                </button>
              </>
            ) : (
              <>
                <p className="font-mono text-[10px] text-paper/50">
                  Pour celles et ceux qui préfèrent écrire le CSS eux-mêmes. Les propriétés tapées sans sélecteur
                  s&apos;appliquent à la carte elle-même ; ajoute <code>{accentSelectorFor(key)} {"{"} ... {"}"}</code>{" "}
                  pour cibler {ACCENT_LABEL[key]}. 8000 caractères max, <code>url()</code>/<code>@import</code>/
                  <code>position: fixed</code> sont retirés automatiquement.
                </p>
                <textarea
                  rows={9}
                  spellCheck={false}
                  className={`${labelClass} w-full rounded-lg border border-paper-dark bg-ink-soft px-3 py-2 font-mono text-xs text-paper outline-none transition focus:border-blue`}
                  value={rawDrafts[key]}
                  maxLength={8000}
                  onChange={(e) => setRawDrafts((d) => ({ ...d, [key]: e.target.value }))}
                />
                <button
                  onClick={() => saveAdvanced(key)}
                  disabled={savingSection === key}
                  className="rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingSection === key ? "Enregistrement…" : "Enregistrer"}
                </button>
              </>
            )}

            {saved[key] && (
              <button
                onClick={() => resetSection(key)}
                disabled={savingSection === key}
                className="rounded-lg border border-red px-4 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:opacity-40"
              >
                Retirer le style personnalisé
              </button>
            )}

            <div>
              <p className="mb-1 font-mono text-[10px] uppercase text-paper/40">Aperçu</p>
              <SectionPreview section={key} userId={userId} nickname={nickname} css={previewCss} />
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
