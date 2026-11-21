"use client";

import { useEffect, useState } from "react";
import { readCursorMode, writeCursorMode, type CursorMode } from "@/lib/cursorPrefs";
import { DEFAULT_COMFORT, readComfort, writeComfort, type ComfortPrefs, type MotionPref, type TextPref, type ThemePref } from "@/lib/comfortPrefs";
import { Choices, SettingCard, Toggle } from "./ui";

/** Réglages → Affichage et confort (Lot 93) : propres à ce navigateur. */
export function ComfortSettings() {
  const [cursor, setCursor] = useState<CursorMode | null>(null);
  const [comfort, setComfort] = useState<ComfortPrefs>(DEFAULT_COMFORT);
  useEffect(() => {
    setCursor(readCursorMode());
    setComfort(readComfort());
  }, []);
  const set = (patch: Partial<ComfortPrefs>) => {
    const next = { ...comfort, ...patch };
    setComfort(next);
    writeComfort(next);
  };

  return (
    <div className="space-y-5">
      <p className="note-appareil">Ces réglages ne valent que pour ce navigateur : ton téléphone et ton ordinateur peuvent être réglés différemment.</p>

      <SettingCard icon="palette" title="Apparence du site" intro="Clair comme d'habitude, sombre pour le soir, ou au choix de ton appareil.">
        <Choices<ThemePref>
          label="Thème"
          value={comfort.theme}
          onChange={(v) => set({ theme: v })}
          options={[
            { v: "clair", title: "Clair", hint: "Le fond vif et les cartes crème.", visual: <MiniSite kind="clair" epure={comfort.epure} /> },
            { v: "sombre", title: "Sombre", hint: "Fond de nuit, cartes sombres.", visual: <MiniSite kind="sombre" epure={comfort.epure} /> },
            { v: "auto", title: "Selon l'appareil", hint: "Suit le réglage clair ou sombre de ton système.", visual: <MiniSite kind="auto" epure={comfort.epure} /> },
          ]}
        />
        <Toggle
          checked={comfort.epure}
          onChange={(v) => set({ epure: v })}
          label="Mode épuré"
          hint="Fond uni sans motif ni particules, contours fins sans ombre, titres simples, pas de décors des fêtes. Le site, en plus sobre."
        />
      </SettingCard>

      <SettingCard icon="eye" title="Taille du texte" intro="Tout le Dossier grandit avec.">
        <Choices<TextPref>
          label="Taille du texte"
          value={comfort.text}
          onChange={(v) => set({ text: v })}
          options={[
            { v: "normal", title: "Normale", visual: <span className="aa" style={{ fontSize: "1rem" }}>Aa</span> },
            { v: "large", title: "Grande", visual: <span className="aa" style={{ fontSize: "1.3rem" }}>Aa</span> },
            { v: "xlarge", title: "Très grande", visual: <span className="aa" style={{ fontSize: "1.6rem" }}>Aa</span> },
          ]}
        />
      </SettingCard>

      <SettingCard icon="sparkle" title="Animations" intro="Particules du fond, apparitions, passages des fêtes…">
        <Choices<MotionPref>
          label="Animations"
          value={comfort.motion}
          onChange={(v) => set({ motion: v })}
          cols={2}
          options={[
            { v: "full", title: "Vivantes", hint: "Le site bouge comme prévu.", visual: <span className="mini-anim is-vif" /> },
            { v: "calm", title: "Calmes", hint: "Plus de particules ni d'animations.", visual: <span className="mini-anim" /> },
          ]}
        />
        <Toggle
          checked={comfort.decor && !comfort.epure}
          disabled={comfort.epure}
          onChange={(v) => set({ decor: v })}
          label="Décors des fêtes"
          hint={comfort.epure ? "Coupés par le mode épuré." : "Guirlandes, neige, chauves-souris, confettis et passages animés pendant les évents. Les couleurs de la fête restent."}
        />
      </SettingCard>

      <SettingCard icon="mouse" title="Curseur" intro="Sur ordinateur, avec une souris. Les couleurs suivent la fête du moment.">
        <Choices<CursorMode>
          label="Curseur"
          value={cursor}
          onChange={(v) => {
            writeCursorMode(v);
            setCursor(v);
          }}
          options={[
            { v: "full", title: "Traînée et éclat", hint: "Une traînée suit la souris, un éclat à chaque clic.", visual: <span className="mini-curseur is-trainee" /> },
            { v: "click", title: "Éclat au clic", hint: "Juste l'éclat quand tu cliques.", visual: <span className="mini-curseur is-clic" /> },
            { v: "off", title: "Normal", hint: "Le curseur habituel.", visual: <span className="mini-curseur" /> },
          ]}
        />
      </SettingCard>
    </div>
  );
}

/** Petit aperçu d'une page : fond, barre et deux cartes. */
function MiniSite({ kind, epure }: { kind: "clair" | "sombre" | "auto"; epure: boolean }) {
  return (
    <span className={`mini-site is-${kind} ${epure ? "is-epure" : ""}`}>
      <i className="mini-barre" />
      <i className="mini-carte" />
      <i className="mini-carte is-2" />
    </span>
  );
}
