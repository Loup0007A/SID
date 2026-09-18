"use client";

import { useEffect, useState } from "react";
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

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh(uid: string) {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(100);
    setNotifications((data ?? []) as AppNotification[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await refresh(user.id);

      const sub = supabase
        .channel(`notifications-page:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => refresh(user.id)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sub);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    await refresh(userId);
  }

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="rounded-lg border border-blue px-4 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink">
            Tout marquer lu
          </button>
        )}
      </div>

      {loading ? (
        <p className="font-body text-paper/60">Chargement…</p>
      ) : notifications.length === 0 ? (
        <p className="glass-card p-8 text-center font-body text-paper/60">Rien de nouveau pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={clsx(
                "glass-card block w-full p-4 text-left transition hover:bg-white/10",
                !n.is_read && "border-blue/50"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display uppercase">
                  {TYPE_ICON[n.type] ?? "🔔"} {n.title}
                  {n.count > 1 && <span className="ml-1 text-blue-light">×{n.count}</span>}
                </p>
                {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red" />}
              </div>
              {n.body && <p className="mt-1 font-body text-sm text-paper/70">{n.body}</p>}
              <p className="mt-1 font-mono text-xs text-paper/40">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
