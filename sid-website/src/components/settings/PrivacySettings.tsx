"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { SettingCard, Status, Toggle } from "./ui";

type Row = { id: string; hidden_fields: string[]; is_invisible: boolean | null; presence_visible: boolean | null; activity_visible: boolean | null };

const HIDEABLE: { key: string; label: string }[] = [
  { key: "first_name", label: "Prénom IRL" },
  { key: "last_name", label: "Nom IRL" },
  { key: "age", label: "Âge" },
  { key: "weapons", label: "Armes" },
  { key: "equipment", label: "Équipement" },
  { key: "description", label: "Description" },
  { key: "desired_role", label: "Rôle voulu" },
];

/** Réglages → Confidentialité (Lot 93) : présence, compte invisible, champs masqués. */
export function PrivacySettings({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, hidden_fields, is_invisible, presence_visible, activity_visible")
      .eq("id", userId)
      .single()
      .then(({ data }) => setP(data as Row));
  }, [supabase, userId]);

  if (!p) return <p className="text-sm text-paper/70">Chargement…</p>;

  async function presence(field: "presence_visible" | "activity_visible", next: boolean) {
    setMsg(null);
    const { error } = await supabase.rpc("set_presence_privacy", {
      p_visible: field === "presence_visible" ? next : null,
      p_activity: field === "activity_visible" ? next : null,
    });
    if (error) return setMsg({ ok: false, text: error.message });
    setP((r) => (r ? { ...r, [field]: next } : r));
    setMsg({ ok: true, text: "Présence enregistrée." });
  }
  async function invisible(next: boolean) {
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ is_invisible: next }).eq("id", userId);
    if (error) return setMsg({ ok: false, text: error.message });
    setP((r) => (r ? { ...r, is_invisible: next } : r));
    setMsg({ ok: true, text: next ? "Ton compte est invisible." : "Ton compte est de nouveau visible." });
  }
  async function hide(field: string) {
    if (!p) return;
    const set = new Set(p.hidden_fields ?? []);
    if (set.has(field)) set.delete(field);
    else set.add(field);
    const next = Array.from(set);
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ hidden_fields: next }).eq("id", userId);
    if (error) return setMsg({ ok: false, text: error.message });
    setP((r) => (r ? { ...r, hidden_fields: next } : r));
  }

  return (
    <div className="space-y-5">
      <SettingCard
        icon="eye"
        title="Présence en ligne"
        id="presence"
        intro="L'accueil montre qui est là et ce qu'il fait (« À la banque », « En plein donjon »…). Seule la page en cours est gardée, effacée au bout d'un jour."
      >
        <Toggle checked={p.presence_visible !== false} onChange={(v) => presence("presence_visible", v)} label="Apparaître en ligne" hint="Les autres membres te voient sur l'accueil quand tu es là." />
        <Toggle
          checked={p.activity_visible !== false}
          disabled={p.presence_visible === false}
          onChange={(v) => presence("activity_visible", v)}
          label="Montrer ce que je fais"
          hint="Sinon, ta ligne affiche « Activité masquée »."
        />
      </SettingCard>

      <SettingCard
        icon="ghost"
        title="Compte invisible"
        intro="Tu disparais du trombinoscope, du classement, de la carte, de l'organigramme et des listes de choix. Ce que tu écris reste signé de ton nom."
      >
        <Toggle checked={!!p.is_invisible} onChange={invisible} label={p.is_invisible ? "Mon compte est invisible" : "Rendre mon compte invisible"} hint="L'administration (gestion des comptes) te voit toujours." />
      </SettingCard>

      <SettingCard icon="padlock" title="Champs masqués" intro="Coche ce que les autres membres ne doivent pas voir sur ton dossier. L'administration le voit toujours.">
        <div className="masques">
          {HIDEABLE.map((f) => {
            const on = (p.hidden_fields ?? []).includes(f.key);
            return (
              <button key={f.key} type="button" aria-pressed={on} onClick={() => hide(f.key)} className={clsx("masque", on && "is-on")}>
                <SidIcon name={on ? "padlock" : "eye"} /> {f.label}
                <span className="sr-only">{on ? " (masqué)" : " (visible)"}</span>
              </button>
            );
          })}
        </div>
        <Link href={`/dashboard/profile/${userId}`} className="lien-fleche">
          Voir mon dossier comme les autres →
        </Link>
      </SettingCard>
      <Status msg={msg} />
    </div>
  );
}
