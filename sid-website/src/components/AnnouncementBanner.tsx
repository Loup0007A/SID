"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Announcement } from "@/types/admin";

const SEVERITY_STYLE: Record<Announcement["severity"], { border: string; text: string; icon: string }> = {
  info: { border: "border-blue/60", text: "text-blue-light", icon: "ℹ️" },
  warning: { border: "border-red/60", text: "text-red-light", icon: "⚠️" },
  critical: { border: "border-red", text: "text-red", icon: "🚨" },
};

/**
 * Affiche les annonces actives que le membre n'a pas encore vues (une à la
 * fois, empilées). Fermer une annonce la marque comme lue côté base
 * (acknowledge_announcement) : elle ne réapparaîtra plus pour ce membre.
 */
export function AnnouncementBanner() {
  const supabase = createClient();
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_unread_announcements");
      setQueue((data ?? []) as Announcement[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (queue.length === 0) return null;
  const current = queue[0];
  const style = SEVERITY_STYLE[current.severity];

  async function dismiss() {
    setDismissing(true);
    await supabase.rpc("acknowledge_announcement", { p_id: current.id });
    setDismissing(false);
    setQueue((q) => q.slice(1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`glass-card w-full max-w-md space-y-3 border p-6 ${style.border}`}>
        <p className={`font-display text-lg uppercase tracking-wide ${style.text}`}>
          {style.icon} {current.title}
        </p>
        {current.body && <p className="whitespace-pre-wrap font-body text-sm text-paper/85">{current.body}</p>}
        <div className="flex items-center justify-between pt-1">
          {queue.length > 1 && (
            <span className="font-mono text-[10px] uppercase text-paper/40">
              {queue.length - 1} autre{queue.length - 1 > 1 ? "s" : ""} annonce{queue.length - 1 > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={dismiss}
            disabled={dismissing}
            className="ml-auto rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            {dismissing ? "…" : "J'ai compris"}
          </button>
        </div>
      </div>
    </div>
  );
}
