"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { PushPanel } from "@/components/PushPanel";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import { SettingCard, Status, Toggle } from "./ui";

type Prefs = { muted: string[]; push_muted: string[]; quiet_start: number | null; quiet_end: number | null };
type Level = "all" | "site" | "off";

/** Catégories qu'on peut régler (mêmes types que _notif_mutable, migration 0114). */
const GROUPS: { key: string; icon: IconName; label: string; hint: string; types: string[] }[] = [
  { key: "messages", icon: "chat", label: "Messages", hint: "Conversations privées et de groupe", types: ["chat_message"] },
  { key: "argent", icon: "coins", label: "Argent reçu", hint: "Virements et salaires", types: ["money_received", "salary_paid"] },
  { key: "marche", icon: "gavel", label: "Enchères et bourse", hint: "Surenchères, ventes, ordres exécutés", types: ["auction", "market"] },
  { key: "cadeaux", icon: "gift", label: "Cadeaux et souhaits", hint: "Cadeaux reçus, souhaits exaucés", types: ["gift", "wishlist"] },
  { key: "entreprises", icon: "office", label: "Entreprises", hint: "Frais, embauches, objectifs", types: ["business"] },
  { key: "renforts", icon: "dice", label: "Renforts", hint: "Recrues tirées pour tes missions", types: ["quest_gacha"] },
  { key: "titres", icon: "masks", label: "Titres et farces", hint: "Titre obtenu, farce reçue", types: ["title", "troll"] },
  { key: "sondages", icon: "ballot", label: "Sondages", hint: "Nouveaux sondages et résultats", types: ["poll"] },
  { key: "mariages", icon: "rings", label: "Mariages", hint: "Demandes et unions", types: ["wedding"] },
  { key: "voyages", icon: "compass", label: "Trajets et exploration", hint: "Arrivées, lieux découverts", types: ["travel_arrived", "exploration"] },
  { key: "creatures", icon: "claws", label: "Créatures et Wiki", hint: "Signalements, fiches découvertes", types: ["incursion", "wiki"] },
  { key: "proprietes", icon: "home", label: "Propriétés", hint: "Bâtiment reçu sur la carte", types: ["propriete"] },
];
const ALWAYS = "Quêtes (validation, échec, rapports), candidatures, appels de raid, annonces, sanctions, impôts, litiges et absences";

const LEVELS: { v: Level; label: string; title: string }[] = [
  { v: "all", label: "Partout", title: "Dans la cloche et en notification push" },
  { v: "site", label: "Site", title: "Dans la cloche seulement, sans push" },
  { v: "off", label: "Jamais", title: "Pas de notification" },
];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function levelOf(p: Prefs, types: string[]): Level {
  if (types.every((t) => p.muted.includes(t))) return "off";
  if (types.every((t) => p.muted.includes(t) || p.push_muted.includes(t))) return "site";
  return "all";
}

/** Réglages → Notifications (Lot 93) : cet appareil, catégories, heures calmes. */
export function NotificationSettings() {
  const supabase = useMemo(() => createClient(), []);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.rpc("notif_prefs_get").then(({ data, error }) => {
      if (error) return setMissing(true);
      setPrefs((data as Prefs) ?? { muted: [], push_muted: [], quiet_start: null, quiet_end: null });
    });
  }, [supabase]);

  async function persist(next: Prefs, text: string) {
    const before = prefs;
    setPrefs(next);
    setMsg(null);
    const { data, error } = await supabase.rpc("notif_prefs_set", {
      p_muted: next.muted,
      p_push_muted: next.push_muted,
      p_quiet_start: next.quiet_start,
      p_quiet_end: next.quiet_end,
    });
    if (error) {
      setPrefs(before);
      return setMsg({ ok: false, text: error.message });
    }
    setPrefs(data as Prefs);
    setMsg({ ok: true, text });
  }

  function setLevel(types: string[], level: Level, label: string) {
    if (!prefs) return;
    const muted = prefs.muted.filter((t) => !types.includes(t));
    const push = prefs.push_muted.filter((t) => !types.includes(t));
    if (level === "off") muted.push(...types);
    if (level === "site") push.push(...types);
    const word = level === "all" ? "partout" : level === "site" ? "sur le site seulement" : "plus du tout";
    void persist({ ...prefs, muted, push_muted: push }, `${label} : ${word}.`);
  }

  const quiet = prefs?.quiet_start != null && prefs?.quiet_end != null;
  const offCount = prefs ? GROUPS.filter((g) => levelOf(prefs, g.types) !== "all").length : 0;

  return (
    <div className="space-y-5">
      <div data-tuto="reglages-notifs">
        <PushPanel />
      </div>

      <SettingCard
        icon="bell"
        title="Ce que tu reçois"
        intro="Pour chaque sujet : partout (cloche et push), sur le site seulement, ou jamais."
        aside={offCount > 0 ? <span className="pastille-compte">{offCount} réglé{offCount > 1 ? "s" : ""}</span> : undefined}
      >
        {missing ? (
          <p className="text-sm">Migration 0114 à lancer dans Supabase pour régler les notifications.</p>
        ) : !prefs ? (
          <p className="text-sm opacity-70">Chargement…</p>
        ) : (
          <>
            <ul className="notif-liste">
              {GROUPS.map((g) => {
                const level = levelOf(prefs, g.types);
                return (
                  <li key={g.key} className={clsx("notif-ligne", level === "off" && "is-off")}>
                    <span className="notif-icone" aria-hidden>
                      <SidIcon name={g.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="reglage-ligne-titre">{g.label}</span>
                      <span className="reglage-ligne-aide">{g.hint}</span>
                    </span>
                    <span className="seg-reglage is-petit" role="radiogroup" aria-label={g.label}>
                      {LEVELS.map((l) => (
                        <button key={l.v} role="radio" aria-checked={level === l.v} title={l.title} onClick={() => level !== l.v && setLevel(g.types, l.v, g.label)} className={clsx(level === l.v && "is-on", l.v === "off" && "is-danger")}>
                          {l.label}
                        </button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="notif-toujours">
              <SidIcon name="padlock" /> Toujours reçues : {ALWAYS}.
            </p>
          </>
        )}
        <Status msg={msg} />
      </SettingCard>

      <SettingCard icon="clock" title="Heures calmes" intro="Pas de notification push pendant ces heures (heure de Paris). Rien n'est perdu : tout reste dans la cloche.">
        {prefs && (
          <>
            <Toggle
              checked={quiet}
              onChange={(on) => void persist({ ...prefs, quiet_start: on ? 22 : null, quiet_end: on ? 8 : null }, on ? "Heures calmes de 22 h à 8 h." : "Heures calmes coupées.")}
              label="Activer les heures calmes"
            />
            {quiet && (
              <div className="heures-calmes">
                <label>
                  De
                  <select
                    value={prefs.quiet_start ?? 22}
                    onChange={(e) => void persist({ ...prefs, quiet_start: Number(e.target.value) }, "Heures calmes enregistrées.")}
                    className="champ-court"
                  >
                    {HOURS.filter((h) => h !== prefs.quiet_end).map((h) => (
                      <option key={h} value={h}>
                        {h} h
                      </option>
                    ))}
                  </select>
                </label>
                <span aria-hidden className="heures-trait" />
                <label>
                  à
                  <select
                    value={prefs.quiet_end ?? 8}
                    onChange={(e) => void persist({ ...prefs, quiet_end: Number(e.target.value) }, "Heures calmes enregistrées.")}
                    className="champ-court"
                  >
                    {HOURS.filter((h) => h !== prefs.quiet_start).map((h) => (
                      <option key={h} value={h}>
                        {h} h
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}
      </SettingCard>
    </div>
  );
}
