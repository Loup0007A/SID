"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { NAV_ENTRIES, NAV_GROUPS } from "@/lib/navigation";
import { BRAND } from "@/lib/brand";
import { SIMULATION_SITES, SIMULATION_KINDS } from "@/lib/simulationSites";
import { SidIcon } from "@/components/icons/SidIcon";
import type { ChatMessage, Profile } from "@/types/database";

/**
 * Salon Admin de la messagerie (Lot 80, migration 0097).
 *
 * Seul le maître du salon (app_config.admin_chat_owner) épingle des messages
 * et pose des liens vers les autres lieux du S.I.D. : [[/dashboard/…|Texte]].
 * Les liens ne s'affichent en boutons que dans ses messages ; chez les autres,
 * le texte reste tel quel.
 */

export type AdminChatInfo = { channelId: string; ownerId: string | null; ownerNickname: string | null; isOwner: boolean };

const TOKEN = /\[\[([^\]|]{1,300})\|([^\]]{1,80})\]\]/g;

/** Adresse sûre : une page du site, ou une adresse http(s). */
function safeHref(raw: string): string | null {
  const h = raw.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  try {
    const u = new URL(h);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Texte d'un message, avec les liens du maître du salon en boutons. */
export function AdminContent({ text, links }: { text: string; links: boolean }) {
  if (!links || !text.includes("[[")) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const href = safeHref(m[1]);
    if (!href) continue;
    out.push(text.slice(last, m.index));
    const inner = (
      <>
        <SidIcon name="link" size={13} /> {m[2]}
      </>
    );
    out.push(
      href.startsWith("/") ? (
        <Link key={m.index} href={href} className="admin-link">
          {inner}
        </Link>
      ) : (
        <a key={m.index} href={href} target="_blank" rel="noreferrer" className="admin-link">
          {inner}
        </a>
      ),
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

/** Messages épinglés du salon, en direct. */
export function useAdminPins(channelId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [pins, setPins] = useState<string[]>([]);

  useEffect(() => {
    if (!channelId) return setPins([]);
    const load = () =>
      supabase
        .from("chat_pins")
        .select("message_id, pinned_at")
        .eq("channel_id", channelId)
        .order("pinned_at", { ascending: true })
        .then(({ data }) => setPins((data ?? []).map((p) => p.message_id as string)));
    load();
    const sub = supabase
      .channel(`chat-pins:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_pins", filter: `channel_id=eq.${channelId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, supabase]);

  return { pins, setPins };
}

/** Bandeau des messages épinglés, en haut du salon. */
export function AdminPins({
  pins,
  messages,
  profiles,
  ownerId,
  isOwner,
  onUnpin,
  onJump,
}: {
  pins: string[];
  messages: ChatMessage[];
  profiles: Map<string, Profile>;
  ownerId: string | null;
  isOwner: boolean;
  onUnpin: (id: string) => void;
  onJump: (id: string) => void;
}) {
  // Sur téléphone, le bandeau commence replié : la discussion garde la place.
  const [open, setOpen] = useState(() => typeof window === "undefined" || !window.matchMedia?.("(max-width: 640px)").matches);
  const [full, setFull] = useState<Set<string>>(new Set());
  const list = pins.map((id) => messages.find((m) => m.id === id)).filter((m): m is ChatMessage => !!m && !m.is_deleted);
  if (!list.length) return null;
  return (
    <div className="admin-pins">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="admin-pins-head">
        <SidIcon name="pin" size={14} /> {list.length} message{list.length > 1 ? "s" : ""} épinglé{list.length > 1 ? "s" : ""}
        <span className="ml-auto" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <ul className="admin-pins-list">
          {list.map((m) => (
            <li key={m.id} className="admin-pin">
              <p className={clsx("admin-pin-text", !full.has(m.id) && "is-clamped")}>
                <AdminContent text={m.content} links={m.sender_id === ownerId} />
              </p>
              <div className="admin-pin-foot">
                <span>{profiles.get(m.sender_id)?.nickname ?? "Agent"}</span>
                {(m.content.length > 220 || m.content.split("\n").length > 4) && (
                  <button type="button" onClick={() => setFull((f) => {
                    const n = new Set(f);
                    if (n.has(m.id)) n.delete(m.id);
                    else n.add(m.id);
                    return n;
                  })}>
                    {full.has(m.id) ? "Réduire" : "Lire en entier"}
                  </button>
                )}
                <button type="button" onClick={() => onJump(m.id)}>
                  Voir dans le fil
                </button>
                {isOwner && (
                  <button type="button" onClick={() => onUnpin(m.id)}>
                    Désépingler
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Place = { label: string; href: string; hint?: string };

/** Lieux du S.I.D. à proposer comme liens (maître du salon). */
function places(): { group: string; items: Place[] }[] {
  const groups = NAV_GROUPS.map((g) => ({
    group: g.label,
    items: NAV_ENTRIES.filter((e) => e.group === g.key).map((e) => ({ label: e.label, href: e.href, hint: e.description })),
  }));
  const other: Place[] = [
    { label: "Accueil", href: "/dashboard", hint: "Tableau de bord" },
    { label: "Retraits à valider", href: "/dashboard/admin/economy#retraits", hint: "Économie → À traiter" },
    { label: "Caisse commune", href: "/dashboard/admin/economy#caisse", hint: "Économie → Impôts" },
    ...(BRAND.sites.map ? [{ label: BRAND.map, href: BRAND.urls.map, hint: "Autre site" }] : []),
    ...(BRAND.sites.wiki ? [{ label: BRAND.wiki, href: BRAND.urls.wiki, hint: "Autre site" }] : []),
    ...SIMULATION_KINDS.filter((k) => SIMULATION_SITES[k].url).map((k) => ({
      label: SIMULATION_SITES[k].label,
      href: `/dashboard/simulations/${k}`,
      hint: "Simulation",
    })),
  ];
  return [{ group: "Raccourcis", items: other }, ...groups];
}

/** Choisir un lieu du S.I.D. : insère [[adresse|texte]] dans le message. */
export function AdminLinkPicker({ onPick, onClose }: { onPick: (token: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const [label, setLabel] = useState("");
  const list = places();
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const match = (p: Place) => !q.trim() || norm(`${p.label} ${p.hint ?? ""}`).includes(norm(q.trim()));
  const pick = (href: string, text: string) => onPick(`[[${href}|${text.replace(/[[\]|]/g, "")}]]`);
  const customHref = safeHref(custom);

  return (
    <div className="admin-picker" role="dialog" aria-label="Lien vers un lieu du S.I.D.">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un lieu…"
          aria-label="Chercher un lieu"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 font-body text-sm text-paper outline-none focus:border-blue"
        />
        <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase text-paper/60 hover:text-paper">
          Fermer
        </button>
      </div>
      <div className="admin-picker-list">
        {list.map((g) => {
          const items = g.items.filter(match);
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="admin-picker-group">{g.group}</p>
              {items.map((p) => (
                <button type="button" key={`${g.group}-${p.href}`} onClick={() => pick(p.href, p.label)} className="admin-picker-item">
                  <span className="truncate">{p.label}</span>
                  {p.hint && <span className="truncate text-paper/45">{p.hint}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5 border-t border-white/10 pt-2">
        <p className="admin-picker-group">Autre adresse</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="/dashboard/… ou https://…"
            aria-label="Adresse"
            className={clsx(
              "min-w-0 flex-[2] rounded-lg border bg-black/25 px-3 py-1.5 font-mono text-xs text-paper outline-none",
              custom && !customHref ? "border-red/60" : "border-white/15 focus:border-blue",
            )}
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Texte du bouton"
            aria-label="Texte du bouton"
            maxLength={60}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/25 px-3 py-1.5 font-body text-sm text-paper outline-none focus:border-blue"
          />
          <button
            type="button"
            disabled={!customHref || !label.trim()}
            onClick={() => customHref && pick(customHref, label.trim())}
            className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
          >
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}
