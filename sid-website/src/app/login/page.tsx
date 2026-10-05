"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { inputClass, buttonSecondary } from "@/lib/ui";
import { ResendConfirmation } from "@/components/ResendConfirmation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsConfirmation(false);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        setError("Ton email n'est pas encore confirmé. Renvoie l'email ou saisis le code reçu ci-dessous.");
        setNeedsConfirmation(true);
      } else if (msg.includes("invalid login credentials")) {
        setError("Email ou mot de passe incorrect.");
      } else {
        // on affiche le message brut de Supabase pour pouvoir diagnostiquer
        // facilement les cas moins courants, plutôt qu'un message générique
        setError(error.message);
      }
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="glass-card w-full max-w-sm space-y-4 p-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo S.I.D." className="h-12 w-12 rounded-full" />
          <h1 className="font-display text-2xl uppercase tracking-wide">Accès au dossier</h1>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide">Identifiant (email)</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs uppercase tracking-wide">Mot de passe</label>
            <Link href="/forgot-password" className="font-mono text-[10px] uppercase text-blue underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-2 font-mono text-[10px] uppercase text-ink/60 hover:text-ink"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? "Masquer" : "Voir"}
            </button>
          </div>
        </div>

        {error && <p className="font-mono text-xs text-red">{error}</p>}

        {needsConfirmation && (
          <ResendConfirmation
            email={email}
            onVerified={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          />
        )}

        <button type="submit" disabled={loading} className={`w-full ${buttonSecondary}`}>
          {loading ? "Vérification…" : "Entrer"}
        </button>

        <p className="text-center font-body text-sm text-paper/70">
          Pas encore de dossier ?{" "}
          <Link href="/register" className="text-blue underline">
            Déposer une candidature
          </Link>
        </p>
      </form>
    </main>
  );
}
