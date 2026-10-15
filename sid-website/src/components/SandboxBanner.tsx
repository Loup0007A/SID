"use client";

import { useEffect, useState } from "react";
import type { PermissionKey } from "@/types/database";
import { PERMISSION_LABELS, leaveSandbox, savedAdminNickname, timeLeft } from "@/lib/sandbox";

/** Bandeau affiché en haut de tout le site quand on navigue avec un compte de test. */
export function SandboxBanner({ nickname, expiresAt, permissions }: { nickname: string; expiresAt: string; permissions: Set<PermissionKey> }) {
  const [, tick] = useState(0);
  const [admin, setAdmin] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setAdmin(savedAdminNickname());
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const perms = Array.from(permissions).map((p) => PERMISSION_LABELS[p] ?? p);

  return (
    <div className="construction-tape" role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <span className="construction-tape-label text-xs sm:text-sm">🧪 Bac à sable</span>
        <span className="rounded bg-ink/85 px-2 py-1 font-mono text-[11px] text-paper">
          Compte de test « {nickname} » · expire dans {timeLeft(expiresAt)} ·{" "}
          {perms.length ? `permissions : ${perms.join(", ")}` : "aucune permission d'administration"}
        </span>
        <button
          onClick={async () => {
            setLeaving(true);
            await leaveSandbox();
          }}
          disabled={leaving}
          className="ml-auto rounded-lg bg-ink px-3 py-1.5 font-mono text-xs uppercase text-paper hover:bg-ink/80 disabled:opacity-50"
        >
          {leaving ? "…" : admin ? `Revenir à ${admin}` : "Quitter le compte de test"}
        </button>
      </div>
    </div>
  );
}
