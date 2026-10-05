"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { inputClass, buttonSecondary } from "@/lib/ui";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      setError(
        m.includes("rate limit") || m.includes("seconds")
          ? "Trop de demandes d'affilée : patiente un peu avant de réessayer."
          : error.message
      );
      return;
    }
    // Message volontairement identique que l'adresse existe ou non, pour ne
    // pas permettre de deviner quels emails ont un compte.
    setSent(true);
    setCooldown(COOLDOWN_SECONDS);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-card w-full max-w-sm space-y-4 p-8">
        <h1 className="font-display text-2xl uppercase tracking-wide">Mot de passe oublié</h1>
        <p className="font-body text-sm text-paper/70">
          Indique l&apos;email de ton compte : si un dossier y correspond, tu recevras un lien pour choisir un
          nouveau mot de passe.
        </p>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        {sent && (
          <p className="rounded-lg border border-blue/40 bg-blue/10 p-3 font-body text-sm text-blue-light">
            Si un compte existe pour cette adresse, un email vient d&apos;être envoyé. Pense à vérifier tes spams.
          </p>
        )}
        {error && <p className="font-mono text-xs text-red">{error}</p>}

        <button type="submit" disabled={loading || cooldown > 0} className={`w-full ${buttonSecondary}`}>
          {loading ? "Envoi…" : cooldown > 0 ? `Renvoyer dans ${cooldown} s` : sent ? "Renvoyer le lien" : "Envoyer le lien"}
        </button>

        <p className="text-center font-body text-sm text-paper/70">
          <Link href="/login" className="text-blue underline">
            Retour à la connexion
          </Link>
        </p>
      </form>
    </main>
  );
}
