"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TERMS_VERSION } from "@/components/legal/LegalContent";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Demande d'accepter les CGU et la politique de confidentialité (une fois par
 * version). Reste affiché en haut du site tant que ce n'est pas fait.
 */
export function TermsBanner({ acceptedVersion, onAccepted }: { acceptedVersion: string | null | undefined; onAccepted?: () => void }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done || acceptedVersion === TERMS_VERSION) return null;

  async function accept() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("accept_terms", { p_version: TERMS_VERSION });
    setBusy(false);
    if (error) {
      setError(error.message.includes("accept_terms") ? "Pas encore disponible (migration 0060 à lancer)." : error.message);
      return;
    }
    setDone(true);
    onAccepted?.();
  }

  return (
    <div className="border-b border-blue/40 bg-blue/15" role="region" aria-label="Conditions d'utilisation">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-[14rem] flex-1 font-body text-sm text-paper/90">
          <SidIcon name="scroll" /> {acceptedVersion ? "Nos conditions d'utilisation et notre politique de confidentialité ont changé." : "Le S.I.D. a maintenant des conditions d'utilisation et une politique de confidentialité."}{" "}
          Prends deux minutes pour lire{" "}
          <Link href="/cgu" className="text-blue-light underline">les conditions</Link> et{" "}
          <Link href="/confidentialite" className="text-blue-light underline">ce que nous faisons de tes données</Link>.
          {error && <span className="block font-mono text-xs text-red">{error}</span>}
        </p>
        <button
          onClick={accept}
          disabled={busy}
          className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light disabled:opacity-50"
        >
          {busy ? "…" : "J'ai lu et j'accepte"}
        </button>
      </div>
    </div>
  );
}
