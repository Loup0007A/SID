"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/lib/ui";

const COOLDOWN_SECONDS = 60;

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds")) {
    return "Trop de demandes d'affilée : patiente un peu avant de réessayer.";
  }
  if (m.includes("expired") || m.includes("invalid")) {
    return "Code invalide ou expiré. Demande un nouvel email et utilise le plus récent.";
  }
  return message;
}

/**
 * Permet de (re)recevoir l'email de confirmation d'un compte, et de saisir
 * le code à usage unique qu'il contient si ton email en affiche un (sinon
 * il suffit de cliquer sur le lien reçu). Délai de 60 s entre deux envois.
 */
export function ResendConfirmation({ email, onVerified }: { email: string; onVerified?: () => void }) {
  const supabase = createClient();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email.trim()) {
      setError("Renseigne d'abord ton adresse email.");
      return;
    }
    setSending(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setSending(false);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    setInfo("Email renvoyé. Pense à vérifier tes spams.");
    setCooldown(COOLDOWN_SECONDS);
  }

  async function verify() {
    const token = code.replace(/\s+/g, "");
    if (!/^\d{6,10}$/.test(token)) {
      setError("Le code est composé de chiffres uniquement (6 en général).");
      return;
    }
    setVerifying(true);
    setError(null);
    setInfo(null);
    let res = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (res.error) {
      res = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "signup" });
    }
    setVerifying(false);
    if (res.error) {
      setError(friendlyError(res.error.message));
      return;
    }
    setInfo("Email confirmé !");
    onVerified?.();
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue/40 bg-blue/10 p-3">
      <p className="font-mono text-xs uppercase text-blue-light">✉️ Email de confirmation</p>

      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0}
        className="rounded-lg border border-blue px-3 py-1.5 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? "Envoi…" : cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer l'email"}
      </button>

      <div className="space-y-1">
        <p className="font-body text-xs text-paper/70">
          Si ton email contient un code, saisis-le ici — sinon clique simplement sur le lien qu&apos;il contient.
        </p>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={`${inputClass} flex-1 font-mono tracking-widest`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), verify())}
          />
          <button
            type="button"
            onClick={verify}
            disabled={verifying || !code.trim()}
            className="rounded-lg bg-blue px-3 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {verifying ? "…" : "Valider"}
          </button>
        </div>
      </div>

      {info && <p className="font-mono text-xs text-blue-light">{info}</p>}
      {error && <p className="font-mono text-xs text-red">{error}</p>}
    </div>
  );
}
