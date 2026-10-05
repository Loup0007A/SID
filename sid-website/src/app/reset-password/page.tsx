"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { inputClass, buttonSecondary } from "@/lib/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Le lien reçu par email ouvre cette page avec un jeton de récupération :
  // le client Supabase l'échange automatiquement contre une session, qu'on
  // détecte ici (événement, ou session déjà présente). Sans ça au bout de
  // quelques secondes, le lien est invalide ou expiré.
  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecked(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
    });
    const timer = setTimeout(() => active && setChecked(true), 3000);
    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card w-full max-w-sm space-y-3 p-8 text-center">
          <h1 className="font-display text-2xl uppercase tracking-wide">Nouveau mot de passe</h1>
          {checked ? (
            <>
              <p className="font-body text-sm text-paper/70">
                Ce lien est invalide ou a expiré. Demande-en un nouveau.
              </p>
              <Link href="/forgot-password" className="text-blue underline">
                Mot de passe oublié
              </Link>
            </>
          ) : (
            <p className="font-body text-sm text-paper/60">Vérification du lien…</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-card w-full max-w-sm space-y-4 p-8">
        <h1 className="font-display text-2xl uppercase tracking-wide">Nouveau mot de passe</h1>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide">Nouveau mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide">Confirmation</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="font-mono text-xs text-red">{error}</p>}

        <button type="submit" disabled={saving} className={`w-full ${buttonSecondary}`}>
          {saving ? "Enregistrement…" : "Changer le mot de passe"}
        </button>
      </form>
    </main>
  );
}
