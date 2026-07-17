"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("Identifiants incorrects, ou compte pas encore validé.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={handleSubmit} className="dossier-card w-full max-w-sm space-y-4 p-8">
        <h1 className="font-display text-2xl uppercase tracking-wide">Accès au dossier</h1>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide">Identifiant (email)</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-paper-dark bg-paper px-3 py-2 font-body outline-none focus:border-olive"
          />
        </div>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wide">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-paper-dark bg-paper px-3 py-2 font-body outline-none focus:border-olive"
          />
        </div>

        {error && <p className="font-mono text-xs text-redact">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-olive py-2 font-display uppercase tracking-wide text-paper hover:bg-olive-light disabled:opacity-50"
        >
          {loading ? "Vérification…" : "Entrer"}
        </button>

        <p className="text-center font-body text-sm text-paper-text/70">
          Pas encore de dossier ?{" "}
          <Link href="/register" className="text-teal underline">
            Déposer une candidature
          </Link>
        </p>
      </form>
    </main>
  );
}
