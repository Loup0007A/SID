"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, QuestDifficulty } from "@/types/database";
import { inputClass, labelClass } from "@/lib/ui";
import { RankCard } from "@/components/RankCard";

const HIDEABLE_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "first_name", label: "Prénom IRL" },
  { key: "last_name", label: "Nom IRL" },
  { key: "age", label: "Âge" },
  { key: "weapons", label: "Armes" },
  { key: "equipment", label: "Équipement" },
  { key: "description", label: "Description" },
  { key: "desired_role", label: "Rôle voulu" },
];


export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purchases, setPurchases] = useState<{ item_name: string; quantity: number; last_purchase: string }[]>([]);
  const [saved, setSaved] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);

      const { data: purchasesData } = await supabase.rpc("list_my_purchases");
      setPurchases(purchasesData ?? []);
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

  async function uploadAvatar() {
    if (!profile || !avatarFile) return;
    setAvatarUploading(true);
    setAvatarMessage(null);

    const ext = avatarFile.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });

    if (uploadError) {
      setAvatarMessage(`Échec de l'envoi : ${uploadError.message}`);
      setAvatarUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", profile.id);

    setAvatarUploading(false);
    if (updateError) {
      setAvatarMessage(`Photo envoyée, mais impossible de mettre à jour le profil : ${updateError.message}`);
      return;
    }

    update("avatar_url", pub.publicUrl);
    setAvatarFile(null);
    setAvatarMessage("Photo de profil mise à jour.");
  }

  async function changePassword() {
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordMessage(`Échec : ${error.message}`);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Mot de passe modifié.");
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <RankCard rank={(profile.member_rank as QuestDifficulty) ?? "E"} />
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Mon dossier</h1>
      </div>

      <div className="glass-card space-y-4 p-6">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.nickname} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-paper-dark font-display text-2xl text-ink">
              {profile.nickname.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-2">
            <label className={labelClass}>Photo de profil</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              className="w-full font-body text-sm text-paper/80"
            />
            <button
              onClick={uploadAvatar}
              disabled={!avatarFile || avatarUploading}
              className="rounded-lg bg-blue px-4 py-1 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
            >
              {avatarUploading ? "Envoi…" : "Mettre à jour la photo"}
            </button>
            {avatarMessage && <p className="font-mono text-xs text-red">{avatarMessage}</p>}
          </div>
        </div>

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

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Confidentialité</h2>
        <p className="font-body text-sm text-paper/70">
          Coche les informations que tu veux masquer aux autres membres. Le staff avec la permission
          &quot;gestion des comptes&quot; pourra toujours les voir.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {HIDEABLE_FIELDS.map((f) => (
            <label key={String(f.key)} className="flex items-center gap-2 font-mono text-xs">
              <input
                type="checkbox" className="accent-blue"
                checked={profile.hidden_fields.includes(f.key as string)}
                onChange={(e) => toggleHidden(f.key as string, e.target.checked)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Mot de passe</h2>
        <div className="space-y-1">
          <label className={labelClass}>Nouveau mot de passe</label>
          <input type="password" minLength={8} className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Confirmation</label>
          <input type="password" minLength={8} className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        {passwordMessage && <p className="font-mono text-xs text-red">{passwordMessage}</p>}
        <button
          onClick={changePassword}
          disabled={passwordSaving || !newPassword}
          className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light disabled:opacity-40"
        >
          {passwordSaving ? "Enregistrement…" : "Changer le mot de passe"}
        </button>
      </div>

      <div className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Mes achats</h2>
        {purchases.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Aucun achat pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {purchases.map((p) => (
              <li key={p.item_name} className="flex items-center justify-between py-2 font-body text-sm">
                <span>{p.item_name}</span>
                <span className="font-mono text-xs text-paper/60">× {p.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={save} className="rounded-lg bg-blue px-6 py-2 font-display uppercase text-ink hover:bg-blue-light">
        Enregistrer
      </button>
      {saved && <span className="ml-3 font-mono text-xs text-red">Enregistré.</span>}
    </div>
  );
}
