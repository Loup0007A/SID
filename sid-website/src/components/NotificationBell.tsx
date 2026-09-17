"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/types/notifications";

const TYPE_ICON: Record<string, string> = {
  chat_message: "💬",
  quest_validated: "✅",
  quest_failed: "❌",
  application_decision: "📋",
  quest_confirmation_needed: "⏳",
  travel_arrived: "🧭",
  salary_paid: "💰",
};

export function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const buttonWrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Le composant est rendu deux fois en simultané dans le layout (version
  // desktop + version mobile, l'une des deux étant juste masquée en CSS) :
  // sans identifiant unique, les deux instances créeraient un canal
  // Realtime de même nom ("notifications:<userId>"), ce que Supabase
  // refuse (on ne peut pas ajouter d'écouteur sur un canal déjà abonné par
  // une autre instance). Un suffixe aléatoire par instance évite le conflit.
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Le portail (voir plus bas) ne peut être utilisé qu'une fois le
  // composant monté côté client — `document` n'existe pas côté serveur.
  useEffect(() => setMounted(true), []);

  async function refresh() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(25);
    setNotifications((data ?? []) as AppNotification[]);
  }

  useEffect(() => {
    refresh();

    const sub = supabase
      .channel(`notifications:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .subscribe();

    // Filet de sécurité si le Realtime n'est pas activé sur ce projet
    // (ou temporairement coupé) : on se resynchronise périodiquement.
    const interval = window.setInterval(refresh, 45000);

    return () => {
      supabase.removeChannel(sub);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Le panneau est désormais rendu dans un portail (voir plus bas),
      // donc physiquement en dehors de `buttonWrapperRef` dans le DOM : il
      // faut vérifier les deux zones pour ne pas fermer le panneau dès
      // qu'on clique dedans.
      const clickedButton = buttonWrapperRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedButton && !clickedPanel) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    refresh();
  }

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
    refresh();
  }

  const panel = (
    <div
      ref={panelRef}
      className="glass-card fixed right-3 top-16 z-[999] w-80 max-w-[calc(100vw-1.5rem)] space-y-1 p-2 sm:top-20"
    >
      <div className="flex items-center justify-between px-2 py-1">
        <p className="font-mono text-xs uppercase text-paper/60">Notifications</p>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="font-mono text-[10px] uppercase text-blue-light underline">
            Tout marquer lu
          </button>
        )}
      </div>
      <div className="max-h-[70vh] space-y-1 overflow-y-auto">
        {notifications.length === 0 && (
          <p className="px-2 py-3 text-center font-body text-sm text-paper/50">Rien de nouveau.</p>
        )}
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={clsx("block w-full rounded-lg px-2 py-2 text-left hover:bg-white/10", !n.is_read && "bg-blue/10")}
          >
            <p className="font-mono text-xs">
              {TYPE_ICON[n.type] ?? "🔔"} {n.title}
              {n.count > 1 && <span className="ml-1 text-blue-light">×{n.count}</span>}
            </p>
            {n.body && <p className="mt-0.5 line-clamp-2 font-body text-xs text-paper/70">{n.body}</p>}
            <p className="mt-0.5 font-mono text-[10px] text-paper/40">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative shrink-0" ref={buttonWrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-paper hover:bg-white/10"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 font-mono text-[9px] text-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/*
        Portail direct dans <body> : la sidebar (.grain-panel) et la barre
        mobile (.glass-panel) utilisent toutes les deux `backdrop-filter`,
        qui — comme `filter` ou `transform` — crée un nouveau "containing
        block" CSS. Un enfant en `position: fixed` à l'intérieur ne se
        positionne alors plus par rapport à l'écran mais par rapport à CET
        ANCÊTRE, ce qui provoquait le débordement/chevauchement vu à
        l'écran malgré le passage en `fixed`. Un portail sort le panneau du
        DOM de la sidebar : plus aucun ancêtre filtré ne peut le piéger.
      */}
      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
