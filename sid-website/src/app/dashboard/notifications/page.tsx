"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import type { AppNotification } from "@/types/notifications";
import { Glyph, GlyphText, SidIcon, splitLeadingEmoji, type IconName } from "@/components/icons/SidIcon";
import { pageBeforeNotifs } from "@/lib/notifReturn";

const TYPE_ICON: Record<string, IconName> = {
  chat_message: "chat",
  quest_validated: "check",
  quest_failed: "cross",
  application_decision: "clipboard",
  quest_confirmation_needed: "hourglass",
  travel_arrived: "compass",
  salary_paid: "coins",
  money_received: "moneyFly",
  raid_call: "swords",
  sanction: "scales",
  announcement: "megaphone",
  admin_alert: "siren",
  title: "medal",
  troll: "masks",
  business: "chart",
  auction: "gavel",
  poll: "ballot",
  gift: "gift",
  wishlist: "heart",
  wedding: "rings",
  tax: "receipt",
  dispute: "scales",
  market: "candles",
};

/** Icône d'une notification : celle de son type, sinon celle de l'émoji de son titre (anciens textes). */
function NotifTitle({ type, title }: { type: string; title: string }) {
  const { emoji, rest } = splitLeadingEmoji(title);
  const icon = TYPE_ICON[type];
  return (
    <>
      {icon ? <SidIcon name={icon} size="1.3em" /> : emoji ? <Glyph e={emoji} size="1.3em" /> : <SidIcon name="bell" size="1.3em" />} <GlyphText text={rest} />
    </>
  );
}

const TZ = "Europe/Paris";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { timeZone: TZ });
const hour = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  const d = new Date(`${key}T12:00:00`);
  const label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const z = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} z`;

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [back, setBack] = useState<string | null>(null);

  useEffect(() => setBack(pageBeforeNotifs()), []);

  async function refresh(uid: string) {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(150);
    setNotifications((data ?? []) as AppNotification[]);
    setLoading(false);
  }

  useEffect(() => {
    // Abonnement temps réel : nom unique et vrai nettoyage, sinon revenir sur
    // la page réutilisait un canal déjà abonné (erreur « after subscribe() »).
    let sub: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await currentUser();
      if (!user || cancelled) return;
      setUserId(user.id);
      await refresh(user.id);
      if (cancelled) return;

      sub = supabase
        .channel(`notifications-page:${user.id}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => refresh(user.id)
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (sub) supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Par jour (heure de Paris), du plus récent au plus ancien.
  const days = useMemo(() => {
    const out: { key: string; items: AppNotification[] }[] = [];
    for (const n of notifications) {
      const key = dayKey(n.updated_at ?? n.created_at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(n);
      else out.push({ key, items: [n] });
    }
    return out;
  }, [notifications]);

  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    await refresh(userId);
  }

  function toggleDetails(id: string) {
    setOpenDetails((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.link) router.push(n.link);
    else if ((n.details?.length ?? 0) > 1) toggleDetails(n.id);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {back && (
            <Link href={back} scroll={false} className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-xs uppercase text-paper/80 hover:bg-white/10" aria-label="Revenir à la page précédente">
              ← Retour
            </Link>
          )}
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Notifications</h1>
        </div>
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
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.key} aria-labelledby={`jour-${d.key}`} className="space-y-2">
              <h2 id={`jour-${d.key}`} className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60">
                {dayLabel(d.key)}
              </h2>
              <ul className="space-y-2">
                {d.items.map((n) => {
                  const details = n.details ?? [];
                  const grouped = details.length > 1;
                  const open = openDetails.has(n.id);
                  return (
                    <li key={n.id} className={clsx("glass-card overflow-hidden", !n.is_read && "border-blue/50")}>
                      <button onClick={() => handleClick(n)} className="block w-full p-4 text-left transition hover:bg-white/10">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display uppercase">
                            <NotifTitle type={n.type} title={n.title} />
                            {n.count > 1 && !grouped && <span className="ml-1 text-blue-light">×{n.count}</span>}
                          </p>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-[11px] text-paper/60">
                              {grouped && n.updated_at && hour(n.created_at) !== hour(n.updated_at) ? `${hour(n.created_at)} → ${hour(n.updated_at)}` : hour(n.updated_at ?? n.created_at)}
                            </span>
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-red" aria-label="non lue" />}
                          </span>
                        </div>
                        {n.body && <p className="mt-1 font-body text-sm text-paper/70">{n.body}</p>}
                      </button>
                      {grouped && (
                        <div className="border-t border-white/10 px-4 py-2">
                          <button
                            type="button"
                            onClick={() => toggleDetails(n.id)}
                            aria-expanded={open}
                            className="font-mono text-[11px] uppercase tracking-wide text-blue hover:underline"
                          >
                            {open ? "Masquer le détail" : `Voir le détail (${details.length})`}
                          </button>
                          {open && (
                            <ul className="mt-2 space-y-1">
                              {[...details].reverse().map((x, i) => (
                                <li key={i} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 font-body text-sm">
                                  <span className="font-mono text-[11px] text-paper/55">{hour(x.at)}</span>
                                  <span className="min-w-0 text-paper/80">{x.amount != null ? x.text.replace(/^[+−-][\d\s.,]+ z — /, "") : x.text}</span>
                                  {x.amount != null && <span className="font-mono text-xs text-blue-light">{z(Number(x.amount))}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="font-mono text-[11px] text-paper/50">Les nouvelles d&apos;un même sujet à moins de deux heures d&apos;écart sont regroupées. Une notification s&apos;efface 7 jours après ton passage.</p>
        </div>
      )}
    </div>
  );
}
