"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const HIDEABLE_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "first_name", label: "Prénom IRL" },
  { key: "last_name", label: "Nom IRL" },
  { key: "age", label: "Âge" },
  { key: "weapons", label: "Armes" },
  { key: "equipment", label: "Équipement" },
  { key: "description", label: "Description" },
  { key: "desired_role", label: "Rôle voulu" },
];

const inputClass = "w-full border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-olive";
const labelClass = "font-mono text-xs uppercase tracking-wide text-paper-text/80";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return <p className="font-body text-paper/60">Chargement du dossier…</p>;

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  function toggleHidden(field: string, hide: boolean) {
    setProfile((p) => {
      if (!p) return p;
      const set = new Set(p.hidden_fields);
      if (hide) set.add(field);
      else set.delete(field);
      return { ...p, hidden_fields: Array.from(set) };
    });
  }

  async function save() {
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({
        nickname: profile.nickname,
        weapons: profile.weapons,
        equipment: profile.equipment,
        description: profile.description,
        age: profile.age,
        hidden_fields: profile.hidden_fields,
      })
      .eq("id", profile.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display text-2xl uppercase tracking-wide text-brass">Mon dossier</h1>

      <div className="dossier-card space-y-4 p-6">
        <div className="space-y-1">
          <label className={labelClass}>Surnom</label>
          <input className={inputClass} value={profile.nickname} onChange={(e) => update("nickname", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Armes</label>
          <input className={inputClass} value={profile.weapons ?? ""} onChange={(e) => update("weapons", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Équipement</label>
          <input className={inputClass} value={profile.equipment ?? ""} onChange={(e) => update("equipment", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Description</label>
          <textarea rows={4} className={inputClass} value={profile.description ?? ""} onChange={(e) => update("description", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Âge</label>
          <input type="number" className={inputClass} value={profile.age ?? ""} onChange={(e) => update("age", Number(e.target.value))} />
        </div>
      </div>

      <div className="dossier-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Confidentialité</h2>
        <p className="font-body text-sm text-paper-text/70">
          Coche les informations que tu veux masquer aux autres membres. Le staff avec la permission
          &quot;gestion des comptes&quot; pourra toujours les voir.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {HIDEABLE_FIELDS.map((f) => (
            <label key={String(f.key)} className="flex items-center gap-2 font-mono text-xs">
              <input
                type="checkbox"
                checked={profile.hidden_fields.includes(f.key as string)}
                onChange={(e) => toggleHidden(f.key as string, e.target.checked)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} className="bg-olive px-6 py-2 font-display uppercase text-paper hover:bg-olive-light">
        Enregistrer
      </button>
      {saved && <span className="ml-3 font-mono text-xs text-brass">Enregistré.</span>}
    </div>
  );
}
