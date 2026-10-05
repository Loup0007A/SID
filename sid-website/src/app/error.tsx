"use client";

import { useEffect } from "react";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card max-w-md space-y-4 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Erreur</p>
        <h1 className="font-display text-3xl uppercase tracking-wide">Quelque chose s&apos;est mal passé</h1>
        <p className="font-body text-paper/70">
          Une erreur inattendue est survenue. Tu peux réessayer ; si ça persiste, préviens un administrateur.
        </p>
        {error.digest && <p className="font-mono text-[10px] text-paper/40">Référence : {error.digest}</p>}
        <button onClick={reset} className="rounded-lg bg-blue px-5 py-2 font-display uppercase text-ink hover:bg-blue-light">
          Réessayer
        </button>
      </div>
    </main>
  );
}
