"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_CSS_SECTIONS } from "@/types/profileStyle";
import type { ProfileCssSection, ProfileStyleRow } from "@/types/profileStyle";
import { OrgCard } from "@/components/org/OrgCard";
import { ProfileStyle, profileSkinClass } from "@/components/ProfileStyle";
import { CssBuilderPanel } from "@/components/CssBuilderPanel";
import { RankCard } from "@/components/RankCard";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import {
  buildCss,
  parseBuilderOptions,
  defaultBuilderOptions,
  accentSelectorFor,
  type CssBuilderOptions,
} from "@/lib/profileCssBuilder";
import { SettingCard, Status } from "./ui";

const ACCENT_LABEL: Record<ProfileCssSection, string> = {
  org_chart: "titre du poste",
  roster: "ton pseudo",
  leaderboard: "ton pseudo",
  profile: "la grande lettre de rang",
};
const PLACE_ICON: Record<ProfileCssSection, IconName> = {
  org_chart: "orgchart",
  roster: "people",
  leaderboard: "podium1",
  profile: "idcard",
};
const SEED: Record<ProfileCssSection, string> = {
  org_chart: "#8fb3d9",
  roster: "#d99a9a",
  leaderboard: "#8fb3d9",
  profile: "#d4af37",
};

/** Styles prêts à porter : un point de départ, que l'éditeur affine ensuite. */
const PRESETS: { key: string; name: string; colors: string[]; options: Partial<CssBuilderOptions> }[] = [
  {
    key: "sobre", name: "Sobre", colors: ["#2f5bd8", "#fff8ec"],
    options: { borderStyle: "solid", borderColor: "#2f5bd8", borderWidth: 2, borderRadius: 16, backgroundMode: "none", glowEnabled: false, accentColor: "#2f5bd8", animation: "none" },
  },
  {
    key: "or", name: "Or impérial", colors: ["#f2c94c", "#8a5a0b"],
    options: { borderStyle: "double", borderColor: "#d4a530", borderWidth: 4, borderRadius: 14, backgroundMode: "gradient", backgroundColor: "#fff3cf", gradientColor: "#f2c94c", gradientAngle: 150, glowEnabled: true, glowColor: "#f2c94c", glowIntensity: 45, accentColor: "#8a5a0b", animation: "shimmer", animationSpeed: "slow" },
  },
  {
    key: "neon", name: "Néon", colors: ["#3df5ff", "#ff3dcb", "#140b2e"],
    options: { borderStyle: "solid", borderColor: "#3df5ff", borderWidth: 2, borderRadius: 18, backgroundMode: "solid", backgroundColor: "#140b2e", glowEnabled: true, glowColor: "#3df5ff", glowIntensity: 70, accentColor: "#ff3dcb", animation: "neon-flicker", animationSpeed: "normal" },
  },
  {
    key: "braise", name: "Braise", colors: ["#ff7a2a", "#b83e1e", "#3a0e05"],
    options: { borderStyle: "dashed", borderColor: "#ff7a2a", borderWidth: 3, borderRadius: 12, backgroundMode: "gradient", backgroundColor: "#3a0e05", gradientColor: "#b83e1e", gradientAngle: 160, glowEnabled: true, glowColor: "#ff7a2a", glowIntensity: 55, accentColor: "#f2c94c", animation: "glow-pulse", animationSpeed: "fast" },
  },
  {
    key: "givre", name: "Givre", colors: ["#bfe3ff", "#eaf6ff", "#2f5bd8"],
    options: { borderStyle: "solid", borderColor: "#9fd8ff", borderWidth: 2, borderRadius: 22, backgroundMode: "gradient", backgroundColor: "#f4fbff", gradientColor: "#bfe3ff", gradientAngle: 170, glowEnabled: true, glowColor: "#cfefff", glowIntensity: 40, accentColor: "#2f5bd8", animation: "float", animationSpeed: "slow" },
  },
  {
    key: "foret", name: "Forêt", colors: ["#2e9e63", "#e8f6eb", "#1f6b43"],
    options: { borderStyle: "solid", borderColor: "#2e9e63", borderWidth: 3, borderRadius: 10, backgroundMode: "gradient", backgroundColor: "#f4fbf2", gradientColor: "#b7f5c9", gradientAngle: 135, glowEnabled: false, accentColor: "#1f6b43", animation: "none" },
  },
  {
    key: "arc", name: "Arc-en-ciel", colors: ["#ff5fa2", "#ffd166", "#6ec8ff"],
    options: { borderStyle: "solid", borderColor: "#ff5fa2", borderWidth: 3, borderRadius: 20, backgroundMode: "none", glowEnabled: true, glowColor: "#ff5fa2", glowIntensity: 50, accentColor: "#c2276a", animation: "rainbow", animationSpeed: "normal" },
  },
];

type Mode = "visual" | "advanced";
const EMPTY: Record<ProfileCssSection, string> = { org_chart: "", roster: "", leaderboard: "", profile: "" };

/**
 * Réglages → Apparence (Lot 93) : l'habillage de ta carte d'organigramme,
 * de trombinoscope, de ta ligne de classement et de ta fiche. Une place à
 * la fois, avec des styles prêts, l'éditeur visuel (ou le CSS) et un
 * aperçu en direct sur le fond du site.
 */
export function AppearanceSettings({ userId, nickname }: { userId: string; nickname: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [place, setPlace] = useState<ProfileCssSection>("roster");
  const [mode, setMode] = useState<Record<ProfileCssSection, Mode>>({ org_chart: "visual", roster: "visual", leaderboard: "visual", profile: "visual" });
  const [options, setOptions] = useState<Record<ProfileCssSection, CssBuilderOptions>>({
    org_chart: defaultBuilderOptions(SEED.org_chart),
    roster: defaultBuilderOptions(SEED.roster),
    leaderboard: defaultBuilderOptions(SEED.leaderboard),
    profile: defaultBuilderOptions(SEED.profile),
  });
  const [raw, setRaw] = useState<Record<ProfileCssSection, string>>(EMPTY);
  const [saved, setSaved] = useState<Record<ProfileCssSection, string>>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // Une place est « modifiée » dès qu'on y touche, jusqu'au prochain enregistrement.
  const [touched, setTouched] = useState<Record<ProfileCssSection, boolean>>({ org_chart: false, roster: false, leaderboard: false, profile: false });
  const touch = (s: ProfileCssSection, v = true) => setTouched((t) => ({ ...t, [s]: v }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.rpc("get_my_profile_css").then(({ data }) => {
      const next = { ...EMPTY };
      ((data ?? []) as ProfileStyleRow[]).forEach((r) => (next[r.section] = r.css));
      setSaved(next);
      setRaw(next);
      setOptions((o) => {
        const n = { ...o };
        (Object.keys(n) as ProfileCssSection[]).forEach((s) => {
          const p = parseBuilderOptions(next[s]);
          if (p) n[s] = p;
        });
        return n;
      });
      setMode((m) => {
        const n = { ...m };
        // Du CSS écrit à la main : on l'ouvre en mode avancé pour ne rien écraser.
        (Object.keys(n) as ProfileCssSection[]).forEach((s) => {
          if (next[s] && !parseBuilderOptions(next[s])) n[s] = "advanced";
        });
        return n;
      });
      setLoaded(true);
    });
  }, [supabase]);

  const label = (s: ProfileCssSection) => PROFILE_CSS_SECTIONS.find((x) => x.key === s)?.label ?? s;
  const current = mode[place] === "visual" ? buildCss(place, options[place]) : raw[place];
  const dirty = loaded && touched[place] && current !== saved[place];

  function switchMode(next: Mode) {
    if (next === "visual" && mode[place] === "advanced" && raw[place] && !parseBuilderOptions(raw[place])) {
      if (!confirm("L'éditeur visuel remplacera ton CSS écrit à la main par ses propres réglages. Continuer ?")) return;
    }
    setMode((m) => ({ ...m, [place]: next }));
    touch(place);
  }

  async function save(sections: ProfileCssSection[] = [place]) {
    setBusy(true);
    setMsg(null);
    for (const s of sections) {
      const css = mode[place] === "visual" ? buildCss(s, options[place]) : raw[place];
      const { error } = await supabase.rpc("set_profile_css", { p_section: s, p_css: css });
      if (error) {
        setBusy(false);
        return setMsg({ ok: false, text: `${label(s)} : ${error.message}` });
      }
      setSaved((v) => ({ ...v, [s]: css }));
      setRaw((v) => ({ ...v, [s]: css }));
      touch(s, false);
      if (mode[place] === "visual") setOptions((o) => ({ ...o, [s]: options[place] }));
    }
    setBusy(false);
    setMsg({ ok: true, text: sections.length > 1 ? "Ce style habille maintenant tes quatre places." : `Enregistré pour « ${label(place)} ».` });
  }

  async function saveEverywhere() {
    const others = PROFILE_CSS_SECTIONS.filter((s) => s.key !== place && saved[s.key]).length;
    if (others && !confirm(`Remplacer aussi le style de tes ${others} autre${others > 1 ? "s" : ""} place${others > 1 ? "s" : ""} ?`)) return;
    if (mode[place] === "visual") setMode({ org_chart: "visual", roster: "visual", leaderboard: "visual", profile: "visual" });
    await save(PROFILE_CSS_SECTIONS.map((s) => s.key));
  }

  async function reset() {
    if (!confirm(`Retirer ton style de « ${label(place)} » ?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("reset_profile_css", { p_section: place });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setSaved((v) => ({ ...v, [place]: "" }));
    setRaw((v) => ({ ...v, [place]: "" }));
    setOptions((o) => ({ ...o, [place]: defaultBuilderOptions(SEED[place]) }));
    touch(place, false);
    setMsg({ ok: true, text: `« ${label(place)} » reprend l'apparence de tout le monde.` });
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setMode((m) => ({ ...m, [place]: "visual" }));
    setOptions((o) => ({ ...o, [place]: { ...defaultBuilderOptions(SEED[place]), ...p.options } }));
    touch(place);
    setMsg(null);
  }

  return (
    <div className="space-y-5">
      <SettingCard
        icon="palette"
        title="Ta signature"
        tuto="reglages-apparence"
        intro="Tes couleurs, ta bordure, ta lueur et ton animation, sur tes quatre places dans le Dossier. Ton style ne touche que tes propres éléments."
      >
        <div className="place-grille" role="tablist" aria-label="Où s'applique ton style">
          {PROFILE_CSS_SECTIONS.map(({ key, label: l, hint }) => (
            <button
              key={key}
              role="tab"
              aria-selected={place === key}
              onClick={() => {
                setPlace(key);
                setMsg(null);
              }}
              className={clsx("place-tuile", place === key && "is-on")}
            >
              <span className="place-icone" aria-hidden>
                <SidIcon name={PLACE_ICON[key]} />
              </span>
              <span className="place-nom">{l}</span>
              <span className="place-aide">{hint}</span>
              <span className={clsx("place-etat", saved[key] ? "is-perso" : "")}>{saved[key] ? "Personnalisé" : "Par défaut"}</span>
            </button>
          ))}
        </div>
      </SettingCard>

      <div className="atelier">
        <div className="glass-card reglage-card min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="reglage-titre">
              <SidIcon name={PLACE_ICON[place]} /> {label(place)}
            </h2>
            <div className="seg-reglage" role="radiogroup" aria-label="Manière de régler">
              <button role="radio" aria-checked={mode[place] === "visual"} onClick={() => switchMode("visual")} className={clsx(mode[place] === "visual" && "is-on")}>
                Éditeur visuel
              </button>
              <button role="radio" aria-checked={mode[place] === "advanced"} onClick={() => switchMode("advanced")} className={clsx(mode[place] === "advanced" && "is-on")}>
                CSS
              </button>
            </div>
          </div>

          {mode[place] === "visual" ? (
            <>
              <div>
                <p className="reglage-sous-titre">Styles prêts</p>
                <div className="preset-grille">
                  {PRESETS.map((p) => (
                    <button key={p.key} type="button" onClick={() => applyPreset(p)} className="preset">
                      <span
                        className="preset-nuancier"
                        aria-hidden
                        style={{ background: `linear-gradient(135deg, ${p.colors.map((c, i) => `${c} ${Math.round((i / Math.max(1, p.colors.length - 1)) * 100)}%`).join(", ")})` }}
                      />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <CssBuilderPanel accentLabel={ACCENT_LABEL[place]} options={options[place]} onChange={(next) => {
                  setOptions((o) => ({ ...o, [place]: next }));
                  touch(place);
                }}
              />
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-paper/75">
                Les propriétés sans sélecteur s&apos;appliquent à la carte ; <code className="code-pastille">{accentSelectorFor(place)} {"{ … }"}</code> cible {ACCENT_LABEL[place]}.
                8 000 caractères au plus ; <code className="code-pastille">url()</code>, <code className="code-pastille">@import</code> et <code className="code-pastille">position: fixed</code> sont retirés.
              </p>
              <textarea
                rows={12}
                spellCheck={false}
                aria-label={`CSS de « ${label(place)} »`}
                className="css-zone"
                value={raw[place]}
                maxLength={8000}
                onChange={(e) => {
                  setRaw((d) => ({ ...d, [place]: e.target.value }));
                  touch(place);
                }}
              />
            </div>
          )}

          <div className={clsx("barre-enregistrer", dirty && "is-dirty")}>
            <span className="barre-etat">
              {dirty ? (
                <>
                  <span className="point-modif" aria-hidden /> Modifications non enregistrées
                </>
              ) : saved[place] ? (
                "Enregistré"
              ) : (
                "Apparence de tout le monde"
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              {saved[place] && (
                <button onClick={reset} disabled={busy} className="btn-lien">
                  Retirer mon style
                </button>
              )}
              <button onClick={saveEverywhere} disabled={busy || !current} className="btn-contour">
                Appliquer aux 4 places
              </button>
              <button onClick={() => save()} disabled={busy || !dirty} className="bg-blue rounded-xl px-4 py-2 font-display text-sm uppercase text-ink disabled:opacity-40">
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
          <Status msg={msg} />
        </div>

        <aside className="apercu" aria-label="Aperçu en direct">
          <p className="etiquette-collee">Aperçu en direct</p>
          <div className="apercu-scene" data-contraste-libre>
            <SectionPreview section={place} userId={userId} nickname={nickname} css={current} />
          </div>
          <p className="apercu-note">Tel que les autres membres te verront, sur le fond du site.</p>
        </aside>
      </div>
    </div>
  );
}

function SectionPreview({ section, userId, nickname, css }: { section: ProfileCssSection; userId: string; nickname: string; css: string }) {
  const skin = profileSkinClass(userId);
  if (section === "org_chart") {
    return (
      <OrgCard
        label="Poste occupé"
        description="La mission du poste s'affiche ici."
        holder={{ id: userId, nickname, avatar_url: null }}
        team={{ id: "apercu", name: "Équipe rattachée", independent: false }}
        css={css}
        linkHolder={false}
      />
    );
  }
  if (section === "roster") {
    return (
      <div className={`glass-card max-w-xs space-y-1 p-4 ${skin}`}>
        <ProfileStyle userId={userId} css={css} />
        <span className="font-display text-lg uppercase">{nickname}</span>
        <p className="font-mono text-xs text-paper/60">Agent de terrain</p>
        <p className="font-body text-sm text-paper/80">Ta carte, dans la liste des membres.</p>
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
    <div className={`glass-card flex flex-wrap items-center gap-4 p-5 ${skin}`}>
      <ProfileStyle userId={userId} css={css} />
      <RankCard rank="B" />
      <div>
        <p className="font-display text-2xl uppercase tracking-wide text-red">{nickname}</p>
        <p className="font-mono text-xs text-paper/60">En-tête de ta fiche</p>
      </div>
    </div>
  );
}
