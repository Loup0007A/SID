"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import { NOTIFS_PATH, pageBeforeNotifs } from "@/lib/notifReturn";

/**
 * Simple lien vers /dashboard/notifications, avec juste un badge de
 * compteur non lu tenu à jour en direct. Volontairement PAS de menu
 * déroulant : un panneau positionné (absolute/fixed/portal) s'est révélé
 * source de bugs récurrents (débordement, ancrage qui ne suit pas le
 * scroll…) selon l'appareil. Une page dédiée, comme les autres onglets du
 * site, est beaucoup plus robuste.
 *
 * Depuis la page Notifications, la cloche ramène à la page d'avant (Lot 66).
 */
export function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const onNotifs = pathname.startsWith(NOTIFS_PATH);
  const [back, setBack] = useState("/dashboard");
  useEffect(() => {
    if (onNotifs) setBack(pageBeforeNotifs() ?? "/dashboard");
  }, [onNotifs]);
  // Le composant est rendu deux fois en simultané dans le layout (version
  // desktop + version mobile, l'une des deux étant juste masquée en CSS) :
  // sans identifiant unique, les deux instances créeraient un canal
  // Realtime de même nom, ce que Supabase refuse.
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;

  async function refreshCount() {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  }

  useEffect(() => {
    refreshCount();

    const sub = supabase
      .channel(`notifications-badge:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => refreshCount()
      )
      .subscribe();

    const interval = window.setInterval(refreshCount, 45000);

    return () => {
      supabase.removeChannel(sub);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <Link
      href={onNotifs ? back : NOTIFS_PATH}
      scroll={!onNotifs}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-paper hover:bg-white/10 ${onNotifs ? "border-blue/60 bg-blue/15" : "border-white/15 bg-white/5"}`}
      aria-label={onNotifs ? "Fermer les notifications" : "Notifications"}
      title={onNotifs ? "Revenir à la page précédente" : undefined}
    >
      <SidIcon name="bell" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 font-mono text-[9px] text-ink">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
