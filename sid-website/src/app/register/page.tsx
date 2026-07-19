"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-olive";
const labelClass = "font-mono text-xs uppercase tracking-wide text-paper-text/80";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    weapons: "",
    desiredRole: "",
    equipment: "",
    description: "",
    age: "",
    email: "",
    password: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          nickname: form.nickname,
          weapons: form.weapons,
          desired_role: form.desiredRole,
          equipment: form.equipment,
          description: form.description,
          age: form.age,
        },
      },
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Impossible de créer le dossier.");
      return;
    }

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${data.user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });

      if (!uploadError) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", data.user.id);
      }
    }

    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="dossier-card max-w-md space-y-3 p-8 text-center">
          <h1 className="font-display text-2xl uppercase">Dossier transmis</h1>
          <p className="font-body">
            Ta candidature a été envoyée aux officiers recruteurs. Tu recevras une réponse via la
            messagerie une fois ton dossier examiné. Tu peux te connecter dès maintenant pour suivre
            son statut.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="bg-olive px-5 py-2 font-display uppercase text-paper hover:bg-olive-light"
          >
            Aller à la connexion
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink px-4 py-12">
      <form onSubmit={handleSubmit} className="dossier-card mx-auto max-w-2xl space-y-5 p-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Formulaire d&apos;engagement</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">Candidature S.I.D.</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass}>Prénom (IRL)</label>
            <input required className={inputClass} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Nom (IRL)</label>
            <input required className={inputClass} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Surnom</label>
            <input required className={inputClass} value={form.nickname} onChange={(e) => update("nickname", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Âge</label>
            <input type="number" min={0} className={inputClass} value={form.age} onChange={(e) => update("age", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Rôle voulu</label>
            <input className={inputClass} value={form.desiredRole} onChange={(e) => update("desiredRole", e.target.value)} placeholder="Ex : Agent de terrain, Éclaireur…" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Armes</label>
            <input className={inputClass} value={form.weapons} onChange={(e) => update("weapons", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Équipement</label>
            <input className={inputClass} value={form.equipment} onChange={(e) => update("equipment", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Description du personnage</label>
            <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Photo de profil</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              className="w-full font-body text-sm text-paper-text"
            />
          </div>

          <div className="space-y-1 sm:col-span-2 border-t border-paper-dark pt-4">
            <label className={labelClass}>Email (identifiant de connexion)</label>
            <input type="email" required className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Mot de passe</label>
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>
        </div>

        {error && <p className="font-mono text-xs text-redact">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brass py-3 font-display uppercase tracking-wide text-ink hover:bg-brass-light disabled:opacity-50"
        >
          {loading ? "Transmission…" : "Transmettre ma candidature"}
        </button>
      </form>
    </main>
  );
}
