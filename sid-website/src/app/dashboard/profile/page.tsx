"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import type { Profile } from "@/types/database";
import { inputClass, labelClass } from "@/lib/ui";
import { RankCard } from "@/components/RankCard";
import Link from "next/link";
import { BirthdaySetting } from "@/components/lazy/Seals";
import { TitleAuraLayer, TitleBadge } from "@/components/titles/TitleVisuals";
import { useEquippedTitles } from "@/lib/useEquippedTitles";
import type { TitleId } from "@/lib/titles";
import { SidIcon } from "@/components/icons/SidIcon";
import { ReputationCard } from "@/components/ReputationCard";
import { AgentCardButton } from "@/components/AgentCard";
import { myProfile } from "@/lib/profileColumns";



export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purchases, setPurchases] = useState<{ item_name: string; quantity: number; last_purchase: string }[]>([]);
  const [saved, setSaved] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [myId, setMyId] = useState<string>("");
  const myTitle = useEquippedTitles(myId ? [myId] : []).get(myId);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await currentUser();
      if (!user) return;
      setMyId(user.id);
      // Dossier et achats : en même temps.
      const [{ data }, { data: purchasesData }] = await Promise.all([
        myProfile(supabase, user.id),
        supabase.rpc("list_my_purchases"),
      ]);
      setProfile(data);
      setPurchases(purchasesData ?? []);

    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return <p className="font-body text-paper/60">Chargement du dossier…</p>;

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
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


  return (
    <div className="max-w-2xl space-y-8">
      <div data-tuto="profil-rang" className="flex flex-wrap items-center gap-4">
        <RankCard rank={profile.member_rank ?? "E"} />
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Mon dossier</h1>
        <AgentCardButton
          profile={profile}
          title={myTitle ? { id: myTitle.title_id as TitleId, level: myTitle.level } : null}
          reputation={Number(profile.reputation ?? 0)}
        />
      </div>

      <Link href="/dashboard/titles" className="glass-card relative block overflow-hidden p-5 transition hover:-translate-y-0.5">
        {myTitle && <TitleAuraLayer titleId={myTitle.title_id} dragon={myTitle.dragon} compact />}
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60">Titre</p>
            {myTitle ? (
              <TitleBadge titleId={myTitle.title_id} level={myTitle.level} dragon={myTitle.dragon} size="md" />
            ) : (
              <p className="font-body text-sm text-paper/70">Aucun titre équipé. Douze titres secrets t&apos;attendent…</p>
            )}
          </div>
          <span className="font-mono text-xs uppercase text-blue-light">Mes titres →</span>
        </div>
      </Link>

      <ReputationCard />

      <div data-tuto="profil-fiche" className="glass-card space-y-4 p-6">
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

      {myId && <BirthdaySetting userId={myId} />}

      <Link href="/dashboard/settings#confidentialite" className="glass-card flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-encre bg-accent-2 text-xl">
          <SidIcon name="gear" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg uppercase">Réglages</span>
          <span className="block font-body text-sm text-paper/75">
            Notifications, confidentialité (présence, compte invisible, champs masqués), mot de passe et apparence de ta fiche.
          </span>
        </span>
        <span aria-hidden className="text-2xl">→</span>
      </Link>

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
