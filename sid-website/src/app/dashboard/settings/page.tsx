"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import { useTuto } from "@/components/tuto/TutoProvider";
import { TOUR } from "@/lib/tuto/content";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ComfortSettings } from "@/components/settings/ComfortSettings";
import { PrivacySettings } from "@/components/settings/PrivacySettings";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { GuideSettings } from "@/components/settings/GuideSettings";
import "./settings.css";

type Key = "apparence" | "notifications" | "confort" | "confidentialite" | "compte" | "guide";
const SECTIONS: { key: Key; icon: IconName; label: string; hint: string }[] = [
  { key: "apparence", icon: "palette", label: "Apparence", hint: "Ta carte, ta ligne, ta fiche" },
  { key: "notifications", icon: "bell", label: "Notifications", hint: "Push, sujets, heures calmes" },
  { key: "confort", icon: "eye", label: "Affichage", hint: "Sombre, épuré, texte, animations" },
  { key: "confidentialite", icon: "ghost", label: "Confidentialité", hint: "Présence, invisibilité" },
  { key: "compte", icon: "padlock", label: "Compte", hint: "Mot de passe, sessions, données" },
  { key: "guide", icon: "bulb", label: "Guide", hint: "Astuces et visite" },
];
const isKey = (v: string): v is Key => SECTIONS.some((s) => s.key === v);

/**
 * Réglages (Lot 93) : tout ce qui concerne le membre, rangé par sujet.
 * L'adresse garde le sujet ouvert (#notifications…), pour y renvoyer.
 */
export default function SettingsPage() {
  const tuto = useTuto();
  const [me, setMe] = useState<{ id: string; email: string | null; nickname: string } | null>(null);
  const [section, setSection] = useState<Key>("apparence");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await currentUser();
      if (!user) return;
      const { data } = await createClient().from("profiles").select("nickname").eq("id", user.id).single();
      setMe({ id: user.id, email: user.email ?? null, nickname: data?.nickname ?? "Ton pseudo" });
    })();
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      // Ancien lien vers la présence (accueil) : rangée dans Confidentialité.
      if (h === "presence") return setSection("confidentialite");
      if (isKey(h)) setSection(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  // Visite guidée : l'étape « notifications » montre le bon sujet.
  const tourTarget = tuto?.tour ? TOUR[tuto.tour.index]?.target : null;
  useEffect(() => {
    if (tourTarget === "reglages-notifs") setSection("notifications");
    if (tourTarget === "reglages-apparence") setSection("apparence");
  }, [tourTarget]);

  function open(k: Key) {
    setSection(k);
    history.replaceState(null, "", `#${k}`);
    if (window.innerWidth < 900) document.getElementById("reglages-contenu")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const current = SECTIONS.find((s) => s.key === section)!;

  return (
    <div className="reglages">
      <header className="reglages-entete">
        <h1 className="titre-sticker reglages-h1">Réglages</h1>
        <p className="etiquette-collee">Tout ce qui te concerne, rangé au même endroit</p>
      </header>

      <div className="reglages-grille">
        <nav aria-label="Sujets des réglages" className="reglages-nav">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => open(s.key)} aria-current={section === s.key ? "page" : undefined} className={clsx("reglages-onglet", section === s.key && "is-on")}>
              <span className="reglages-onglet-icone" aria-hidden>
                <SidIcon name={s.icon} />
              </span>
              <span className="min-w-0">
                <span className="reglages-onglet-nom">{s.label}</span>
                <span className="reglages-onglet-aide">{s.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div id="reglages-contenu" className="min-w-0 scroll-mt-24">
          <h2 className="sr-only">{current.label}</h2>
          {!me ? (
            <p className="glass-card reglage-card text-sm">Chargement…</p>
          ) : section === "apparence" ? (
            <AppearanceSettings userId={me.id} nickname={me.nickname} />
          ) : section === "notifications" ? (
            <NotificationSettings />
          ) : section === "confort" ? (
            <ComfortSettings />
          ) : section === "confidentialite" ? (
            <PrivacySettings userId={me.id} />
          ) : section === "compte" ? (
            <AccountSettings email={me.email} />
          ) : (
            <GuideSettings />
          )}
        </div>
      </div>
    </div>
  );
}
