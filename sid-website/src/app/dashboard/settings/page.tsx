"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_CSS_SECTIONS } from "@/types/profileStyle";
import type { ProfileCssSection, ProfileStyleRow } from "@/types/profileStyle";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import { labelClass } from "@/lib/ui";

const PLACEHOLDER = `/* Exemple : */\n.rank-card-letter {\n  color: gold;\n}\n.font-display {\n  letter-spacing: 0.2em;\n}`;

export default function SettingsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<ProfileCssSection, string>>({
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

      const { data } = await supabase.rpc("get_my_profile_css");
      const rows = (data ?? []) as ProfileStyleRow[];
      const next = { org_chart: "", roster: "", leaderboard: "", profile: "" } as Record<ProfileCssSection, string>;
      rows.forEach((r) => {
        next[r.section] = r.css;
      });
      setDrafts(next);
      setSaved(next);
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
    if (!confirm("Vider le CSS de cette section ?")) return;
    setSavingSection(section);
    const { error } = await supabase.rpc("reset_profile_css", { p_section: section });
    setSavingSection(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setDrafts((d) => ({ ...d, [section]: "" }));
    setSaved((s) => ({ ...s, [section]: "" }));
  }

  if (!userId) return <p className="font-body text-paper/60">Chargement…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Réglages</h1>

      <section className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Apparence personnalisée</h2>
        <p className="font-body text-sm text-paper/70">
          Un peu de CSS pour chacune des 4 zones où les autres membres te voient. Le CSS ne peut s&apos;appliquer
          qu&apos;à ta propre carte/ligne/fiche — impossible de toucher au reste de la page. Certaines constructions
          sont refusées ou retirées automatiquement (<code>url()</code>, <code>@import</code>,{" "}
          <code>position: fixed</code>, etc.), 8000 caractères maximum par section.
        </p>
        {message && <p className="font-mono text-sm text-red">{message}</p>}
      </section>

      {PROFILE_CSS_SECTIONS.map(({ key, label, hint }) => {
        const dirty = drafts[key] !== saved[key];
        return (
          <section key={key} className="glass-card space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base uppercase text-blue-light">{label}</h3>
                <p className="font-mono text-xs text-paper/50">{hint}</p>
              </div>
              <span className="font-mono text-[10px] text-paper/40">{drafts[key].length} / 8000</span>
            </div>

            <textarea
              rows={8}
              spellCheck={false}
              placeholder={PLACEHOLDER}
              className={`${labelClass} w-full rounded-lg border border-paper-dark bg-ink-soft px-3 py-2 font-mono text-xs text-paper outline-none transition focus:border-blue`}
              value={drafts[key]}
              maxLength={8000}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => save(key)}
                disabled={savingSection === key || !dirty}
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

            {/* Aperçu en direct de ce que les autres verront (nettoyé + scopé) */}
            <div className={`glass-card space-y-1 p-4 ${profileSkinClass(userId)}`}>
              <ProfileStyle userId={userId} css={drafts[key]} />
              <p className="font-mono text-[10px] uppercase text-paper/40">Aperçu</p>
              <p className="font-display text-lg uppercase">Ton pseudo</p>
              <p className="rank-card-letter font-display text-2xl">S</p>
              <p className="font-body text-sm text-paper/80">Un aperçu générique — le rendu réel dépend de la page.</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
