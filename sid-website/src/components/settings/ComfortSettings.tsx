"use client";

import { useEffect, useState } from "react";
import { readCursorMode, writeCursorMode, type CursorMode } from "@/lib/cursorPrefs";
import { COMFORT_EVENT, DEFAULT_COMFORT, readComfort, writeComfort, type ComfortPrefs, type ContrastePref, type MotionPref, type TextPref, type ThemePref } from "@/lib/comfortPrefs";
import { saveComfortToAccount } from "@/components/ComfortSync";
import { Choices, SettingCard, Status, Toggle } from "./ui";

/** Réglages → Affichage et confort (Lots 93-94) : gardés sur le compte, valent sur les trois sites. */
export function ComfortSettings() {
  const [cursor, setCursor] = useState<CursorMode | null>(null);
  const [comfort, setComfort] = useState<ComfortPrefs>(DEFAULT_COMFORT);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    setCursor(readCursorMode());
    setComfort(readComfort());
    // ComfortSync peut recopier les réglages du compte après l'ouverture.
    const sync = () => setComfort(readComfort());
    window.addEventListener(COMFORT_EVENT, sync);
    return () => window.removeEventListener(COMFORT_EVENT, sync);
  }, []);
  const set = (patch: Partial<ComfortPrefs>) => {
    const next = { ...comfort, ...patch };
    setComfort(next);
    writeComfort(next);
    setMsg(null);
    void saveComfortToAccount(next).then((err) =>
      setMsg(err ? { ok: false, text: err.includes("display_prefs") ? "Gardé sur cet appareil seulement : la migration 0116 doit être lancée." : err } : { ok: true, text: "Enregistré sur ton compte." })
    );
  };

  return (
    <div className="space-y-5">
      <p className="note-appareil">
        Ces réglages suivent ton compte : ils valent ici, sur la Cartographie et sur le Wiki. Pour qu&apos;un appareil reste différent, choisis « Selon l&apos;appareil ».
      </p>
      <Status msg={msg} />

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

      <SettingCard icon="bulb" title="Contraste" intro="Pour lire plus facilement : textes pleins, bordures marquées, sans motif derrière le texte.">
        <Choices<ContrastePref>
          label="Contraste"
          value={comfort.contraste}
          onChange={(v) => set({ contraste: v })}
          options={[
            { v: "normal", title: "Normal", hint: "Le site tel quel.", visual: <span className="aa mini-contraste">Aa</span> },
            { v: "fort", title: "Renforcé", hint: "Textes et bordures pleins, fond uni.", visual: <span className="aa mini-contraste is-fort">Aa</span> },
            { v: "auto", title: "Selon l'appareil", hint: "Renforcé si ton système demande plus de contraste.", visual: <span className="aa mini-contraste is-auto">Aa</span> },
          ]}
        />
      </SettingCard>

      <SettingCard icon="sparkle" title="Animations" intro="Particules du fond, apparitions, passages des fêtes…">
        <Choices<MotionPref>
          label="Animations"
          value={comfort.motion}
          onChange={(v) => set({ motion: v })}
          options={[
            { v: "full", title: "Vivantes", hint: "Le site bouge comme prévu.", visual: <span className="mini-anim is-vif" /> },
            { v: "calm", title: "Calmes", hint: "Plus de particules ni d'animations.", visual: <span className="mini-anim" /> },
            { v: "auto", title: "Selon l'appareil", hint: "Calmes si ton système demande de réduire les animations.", visual: <span className="mini-anim is-auto" /> },
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
