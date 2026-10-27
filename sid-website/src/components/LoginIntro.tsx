"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

/**
 * Petite animation de connexion (≈ 1,6 s) : le sceau du S.I.D. est scanné,
 * le tampon « Accès autorisé » tombe, et le dossier s'ouvre. L'écran reste
 * affiché jusqu'à l'arrivée sur le tableau de bord (pas de flash du
 * formulaire). Mouvement réduit : presque instantané.
 */
export function LoginIntro({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(onDone, reduce ? 350 : 1650);
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (uid)
        sb.from("profiles")
          .select("nickname")
          .eq("id", uid)
          .maybeSingle()
          .then(({ data: p }) => p?.nickname && setName(p.nickname));
    });
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Directement sous <body> : rien ne passe par-dessus, rien ne la rogne.
  return createPortal(
    <div className="login-intro fixed inset-0 z-[9000] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <div className="login-intro-seal">
          <span className="login-intro-ring" aria-hidden />
          <span className="login-intro-scan" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="" width={96} height={96} className="relative z-[1] h-24 w-24 rounded-full" />
        </div>
        <span className="login-intro-stamp">Accès autorisé</span>
        <p className="login-intro-line font-mono text-xs uppercase tracking-[0.3em] text-paper/70">
          {name ? `Bienvenue, ${name}` : "Bienvenue, agent"} · ouverture du dossier
        </p>
      </div>
    </div>,
    document.body
  );
}
