"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { inputClass } from "@/lib/ui";
import { SettingCard, Status } from "./ui";

/** Réglages → Compte (Lot 93) : adresse, mot de passe, sessions, données. */
export function AccountSettings({ email }: { email: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const strength = pw.length === 0 ? 0 : pw.length < 8 ? 1 : pw.length < 12 || !/[^a-zA-Z]/.test(pw) ? 2 : 3;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "8 caractères au moins." });
    if (pw !== pw2) return setMsg({ ok: false, text: "Les deux mots de passe ne correspondent pas." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Mot de passe changé." });
  }

  async function signOutEverywhere() {
    if (!confirm("Te déconnecter de tous tes appareils, celui-ci compris ?")) return;
    setBusy(true);
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
  }

  return (
    <div className="space-y-5">
      <SettingCard icon="envelope" title="Adresse de connexion" intro="Celle qui reçoit le lien de connexion. Pour la changer, demande à l'administration.">
        <p className="adresse">{email ?? "—"}</p>
      </SettingCard>

      <SettingCard icon="padlock" title="Mot de passe">
        <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Nouveau mot de passe
            <input type={show ? "text" : "password"} autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-semibold">
            Confirmation
            <input type={show ? "text" : "password"} autoComplete="new-password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <div className="force-mdp sm:col-span-2" aria-live="polite">
            <span className={`force-barre f${strength}`} aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span>{["", "Trop court", "Correct", "Solide"][strength]}</span>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Afficher
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy || !pw} className="bg-blue rounded-xl px-4 py-2 font-display text-sm uppercase text-ink disabled:opacity-40">
              {busy ? "…" : "Changer le mot de passe"}
            </button>
          </div>
        </form>
        <Status msg={msg} />
      </SettingCard>

      <SettingCard icon="power" title="Sessions" intro="Un téléphone perdu, un ordinateur partagé : coupe toutes les connexions d'un coup.">
        <button onClick={signOutEverywhere} disabled={busy} className="btn-danger-contour">
          <SidIcon name="power" /> Me déconnecter partout
        </button>
      </SettingCard>

      <Link href="/dashboard/privacy" className="glass-card reglage-card lien-carte">
        <span className="reglage-pastille" aria-hidden>
          <SidIcon name="clipboard" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="reglage-titre block">Mes données</span>
          <span className="reglage-intro block">Tout ce que le S.I.D. garde sur toi, à télécharger ; demande de suppression du compte.</span>
        </span>
        <span aria-hidden className="text-2xl">→</span>
      </Link>
    </div>
  );
}
