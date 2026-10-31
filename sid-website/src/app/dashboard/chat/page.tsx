"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import { loadCurrentUser, can } from "@/lib/permissions";
import { visibleMembers } from "@/lib/visibility";
import type { ChatChannel, ChatMessage, Profile, DmPartner } from "@/types/database";
import { isTrollCommand, playTrollEffect, TROLL_COMMANDS } from "@/lib/trollEffects";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEquippedTitles } from "@/lib/useEquippedTitles";
import { TitleBadge } from "@/components/titles/TitleVisuals";
import { SidIcon, GlyphText } from "@/components/icons/SidIcon";
import { RpBar, RpMessage, RP_MODES, ROLL_ERRORS, parseRp, type RpMode } from "@/components/chat/RpChat";

/** Avatar : la photo, sinon l'initiale sur une couleur tirée du pseudo. */
function Avatar({ name, url, size = 32 }: { name: string; url: string | null | undefined; size?: number }) {
  const hue = Array.from(name).reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} loading="lazy" className="chat-avatar" style={{ width: size, height: size }} />
  ) : (
    <span className="chat-avatar is-initial" aria-hidden style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 38% 42%)` }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const COLOR_PRESETS = ["#D99A9A", "#8FB3D9", "#E8C547", "#3F8F5F", "#B23B2E", ""] as const;

function ChatInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [dmPartners, setDmPartners] = useState<Map<string, string>>(new Map()); // channel_id -> pseudo
  const [activeChannel, setActiveChannel] = useState<string | null>(searchParams.get("channel"));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const senderTitles = useEquippedTitles(Array.from(new Set(messages.map((m) => m.sender_id))));
  const [draft, setDraft] = useState("");
  const [draftBold, setDraftBold] = useState(false);
  const [draftItalic, setDraftItalic] = useState(false);
  const [draftColor, setDraftColor] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Messagerie RP (Lot 62) : façon de parler, et droit de narrer (maîtres du jeu).
  const [rpMode, setRpMode] = useState<RpMode>("say");
  const [showFormat, setShowFormat] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [canNarrate, setCanNarrate] = useState(false);

  // Édition d'un message existant
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editBold, setEditBold] = useState(false);
  const [editItalic, setEditItalic] = useState(false);
  const [editColor, setEditColor] = useState("");

  // Ajout de membres à un groupe existant
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [channelParticipantIds, setChannelParticipantIds] = useState<Set<string>>(new Set());
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);

  async function refreshChannels(uid: string) {
    // Salons (via ses participations) et noms des correspondants : en même temps.
    const [{ data: parts }, { data: partners }] = await Promise.all([
      supabase.from("chat_participants").select("channel_id, chat_channels(*)").eq("user_id", uid),
      supabase.rpc("list_dm_partner_names"),
    ]);
    const chans = ((parts ?? []) as unknown as { chat_channels: ChatChannel | null }[])
      .map((p) => p.chat_channels)
      .filter((c): c is ChatChannel => !!c)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    setChannels(chans);
    setDmPartners(new Map(((partners ?? []) as DmPartner[]).map((p) => [p.channel_id, p.partner_nickname])));
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await currentUser();
      if (!user) return;
      setUserId(user.id);

      // Membres, droits et salons : tout part en même temps.
      const channelsP = refreshChannels(user.id);
      const [{ data: m }, { permissions }] = await Promise.all([
        supabase.from("profiles").select("*").eq("status", "active"),
        loadCurrentUser(),
      ]);
      setProfiles(new Map((m ?? []).map((p) => [p.id, p])));
      // Seuls les admins (permission manage_users, ou fondateur) peuvent
      // utiliser les commandes de troll — pas seulement les non-mutes.
      const admin = can(permissions, "manage_users");
      setIsAdmin(admin);
      setCanNarrate(can(permissions, "manage_quests", "manage_users"));
      // Les comptes invisibles n'apparaissent pas dans les listes de choix
      // (leurs messages restent signés de leur nom).
      setMembers(visibleMembers(m ?? [], user.id, admin));
      await channelsP;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeChannel) return;

    async function loadMessages() {
      const { data } = await supabase.from("chat_messages").select("*").eq("channel_id", activeChannel).order("created_at", { ascending: true });
      setMessages(data ?? []);
      setTimeout(() => scrollToBottom(), 50);
    }
    loadMessages();
    setShowAddMembers(false);
    setEditingId(null);
    refreshChannelParticipants(activeChannel!);

    const sub = supabase
      .channel(`chat:${activeChannel}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannel}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
          setTimeout(() => scrollToBottom(), 50);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannel}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on("broadcast", { event: "troll" }, ({ payload }) => {
        // Effet "troll" reçu d'un autre participant du salon — rien n'est
        // stocké en base, c'est purement un signal éphémère.
        playTrollEffect((payload as { command: string }).command);
        setMessage(`😈 ${(payload as { nickname: string }).nickname} a lancé /${(payload as { command: string }).command}`);
      })
      .subscribe();

    realtimeChannelRef.current = sub;

    return () => {
      supabase.removeChannel(sub);
      realtimeChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  async function refreshChannelParticipants(channelId: string) {
    const { data } = await supabase.from("chat_participants").select("user_id").eq("channel_id", channelId);
    setChannelParticipantIds(new Set((data ?? []).map((p) => p.user_id)));
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeChannel || !userId) return;

    const trimmed = draft.trim();

    if (isTrollCommand(trimmed)) {
      if (!isAdmin) {
        setMessage("Seuls les admins peuvent utiliser les commandes de troll.");
        return;
      }
      if (profiles.get(userId)?.is_muted) {
        setMessage("Tu es mute, impossible d'utiliser les commandes.");
        return;
      }
      // Commande de troll : ni stockée ni affichée comme un message normal —
      // juste diffusée en direct aux autres participants du salon actuellement
      // connectés (Supabase Realtime broadcast, éphémère).
      playTrollEffect(trimmed);
      realtimeChannelRef.current?.send({
        type: "broadcast",
        event: "troll",
        payload: { command: trimmed.replace(/^\//, "").toLowerCase(), nickname: profiles.get(userId)?.nickname ?? "Agent" },
      });
      setDraft("");
      return;
    }

    const rp = parseRp(trimmed, rpMode, canNarrate);
    if ("error" in rp) {
      setMessage(rp.error);
      return;
    }
    if ("roll" in rp) {
      await rollDice(rp.roll);
      setDraft("");
      return;
    }

    const { error } = await supabase.from("chat_messages").insert({
      channel_id: activeChannel,
      sender_id: userId,
      content: rp.content,
      kind: rp.kind,
      is_bold: rp.kind === "say" && draftBold,
      is_italic: rp.kind === "say" && draftItalic,
      color: rp.kind === "say" ? draftColor || null : null,
    });
    if (error) {
      setMessage(`Message non envoyé : ${error.message}`);
      return;
    }
    setDraft("");
  }

  // Lancer de dés : tiré par le serveur (rp_roll), qui publie le résultat.
  async function rollDice(expr: string) {
    if (!activeChannel) return;
    const { data, error } = await supabase.rpc("rp_roll", { p_channel_id: activeChannel, p_expr: expr });
    const err = (data as { error?: string } | null)?.error;
    if (error || err) setMessage(err ? ROLL_ERRORS[err] ?? "Lancer impossible." : `Lancer impossible : ${error?.message}`);
    else setMessage(null);
  }

  // Seule la liste des messages défile (pas toute la page).
  function scrollToBottom() {
    const el = bottomRef.current?.parentElement;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  // À l'ouverture d'une discussion : la page se cale pour montrer toute la
  // conversation, zone de saisie comprise (même sous une astuce de page).
  useEffect(() => {
    if (!activeChannel) return;
    const t = setTimeout(() => shellRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 350);
    return () => clearTimeout(t);
  }, [activeChannel]);

  function startEdit(m: ChatMessage) {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditBold(m.is_bold);
    setEditItalic(m.is_italic);
    setEditColor(m.color ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editContent.trim()) {
      setMessage("Le message ne peut pas être vide.");
      return;
    }
    const { error } = await supabase
      .from("chat_messages")
      .update({ content: editContent.trim(), is_bold: editBold, is_italic: editItalic, color: editColor || null })
      .eq("id", editingId);
    if (error) {
      setMessage(`Échec de la modification : ${error.message}`);
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingId
          ? { ...m, content: editContent.trim(), is_bold: editBold, is_italic: editItalic, color: editColor || null, edited_at: new Date().toISOString() }
          : m
      )
    );
    setEditingId(null);
  }

  async function deleteMessage(id: string) {
    if (!confirm("Supprimer ce message ?")) return;
    const { error } = await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", id);
    if (error) {
      setMessage(`Échec de la suppression : ${error.message}`);
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_deleted: true } : m)));
  }

  async function startDirectMessage(otherId: string) {
    if (!userId) return;
    setMessage(null);

    // Cherche un DM (uniquement type "dm", jamais un groupe partagé) déjà
    // existant entre les deux. Bug corrigé : l'ancienne version comparait
    // tous les salons communs, donc un groupe partagé avec cette personne
    // empêchait à tort d'ouvrir un DM séparé.
    const { data: myChannels } = await supabase.from("chat_participants").select("channel_id").eq("user_id", userId);
    const myIds = (myChannels ?? []).map((c) => c.channel_id);

    let channelId: string | undefined;
    if (myIds.length > 0) {
      const { data: dmChannels } = await supabase.from("chat_channels").select("id").eq("type", "dm").in("id", myIds);
      const myDmIds = (dmChannels ?? []).map((c) => c.id);

      if (myDmIds.length > 0) {
        const { data: theirChannels } = await supabase
          .from("chat_participants")
          .select("channel_id")
          .eq("user_id", otherId)
          .in("channel_id", myDmIds);
        channelId = theirChannels?.[0]?.channel_id as string | undefined;
      }
    }

    if (!channelId) {
      const { data: channel, error: channelError } = await supabase
        .from("chat_channels")
        .insert({ type: "dm", created_by: userId })
        .select()
        .single();
      if (channelError) {
        setMessage(`Impossible de créer la conversation : ${channelError.message}`);
        return;
      }
      channelId = channel?.id;
      if (channelId) {
        const { error: participantsError } = await supabase.from("chat_participants").insert([
          { channel_id: channelId, user_id: userId },
          { channel_id: channelId, user_id: otherId },
        ]);
        if (participantsError) {
          setMessage(`Impossible d'ajouter les participants : ${participantsError.message}`);
          return;
        }
      }
    }

    if (channelId) {
      setShowNew(false);
      await refreshChannels(userId);
      selectChannel(channelId);
    }
  }

  async function createGroup() {
    if (!userId) return;
    if (!groupName.trim()) {
      setMessage("Donne un nom au groupe avant de le créer.");
      return;
    }
    if (selectedMembers.length === 0) {
      setMessage("Sélectionne au moins un membre à ajouter au groupe.");
      return;
    }
    setMessage(null);

    const { data: channel, error: channelError } = await supabase
      .from("chat_channels")
      .insert({ type: "group", name: groupName, created_by: userId })
      .select()
      .single();

    if (channelError) {
      setMessage(`Impossible de créer le groupe : ${channelError.message}`);
      return;
    }

    if (channel) {
      const { error: participantsError } = await supabase.from("chat_participants").insert([
        { channel_id: channel.id, user_id: userId },
        ...selectedMembers.map((id) => ({ channel_id: channel.id, user_id: id })),
      ]);
      if (participantsError) {
        setMessage(`Groupe créé, mais impossible d'ajouter les participants : ${participantsError.message}`);
        return;
      }
      setGroupName("");
      setSelectedMembers([]);
      setShowNew(false);
      await refreshChannels(userId);
      selectChannel(channel.id);
    }
  }

  async function addMembersToChannel() {
    if (!activeChannel || membersToAdd.length === 0) return;
    setMessage(null);
    const { error } = await supabase
      .from("chat_participants")
      .insert(membersToAdd.map((id) => ({ channel_id: activeChannel, user_id: id })));
    if (error) {
      setMessage(`Impossible d'ajouter ces membres : ${error.message}`);
      return;
    }
    setMembersToAdd([]);
    setShowAddMembers(false);
    await refreshChannelParticipants(activeChannel);
    setMessage("Membre(s) ajouté(s) au groupe.");
  }

  function selectChannel(id: string) {
    setActiveChannel(id);
    router.replace(`/dashboard/chat?channel=${id}`);
  }

  function channelLabel(c: ChatChannel) {
    if (c.type === "group" || c.type === "application") return c.name ?? "Discussion";
    return dmPartners.get(c.id) ? `MP — ${dmPartners.get(c.id)}` : "Message privé";
  }

  const activeChannelObj = channels.find((c) => c.id === activeChannel);
  const isGroup = activeChannelObj?.type === "group";

  const activeLabel = activeChannelObj ? channelLabel(activeChannelObj) : "";
  const dayLabel = (d: Date) => {
    const today = new Date();
    const y = new Date(today.getTime() - 86_400_000);
    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === y.toDateString()) return "Hier";
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div ref={shellRef} className="chat-shell">
      <h1 className="sr-only">Messagerie</h1>
      <aside data-tuto="chat-liste" className={clsx("chat-side", activeChannel ? "hidden md:flex" : "flex")}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="chat-side-title">Discussions</h2>
          <button onClick={() => setShowNew((s) => !s)} aria-expanded={showNew} className={clsx("chat-new-btn", showNew && "is-open")}>
            {showNew ? "Fermer" : "+ Nouvelle"}
          </button>
        </div>

        {message && <p className="rounded-lg bg-red/10 px-2 py-1 font-mono text-xs text-red"><GlyphText text={message} /></p>}

        {showNew && (
          <div className="chat-new space-y-3">
            <p className="chat-new-label">Message privé</p>
            <div className="max-h-36 space-y-0.5 overflow-y-auto">
              {members.filter((m) => m.id !== userId).map((m) => (
                <button key={m.id} onClick={() => startDirectMessage(m.id)} className="chat-new-member">
                  <Avatar name={m.nickname} url={m.avatar_url} size={26} />
                  <span className="truncate">{m.nickname}</span>
                </button>
              ))}
            </div>
            <p className="chat-new-label border-t border-white/10 pt-3">Groupe ou scène RP</p>
            <input
              placeholder="Nom (ex. La taverne du Pendu)"
              aria-label="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 font-body text-sm text-paper outline-none focus:border-blue"
            />
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {members.filter((m) => m.id !== userId).map((m) => (
                <label key={m.id} className="flex items-center gap-2 font-body text-sm">
                  <input
                    type="checkbox" className="accent-blue"
                    checked={selectedMembers.includes(m.id)}
                    onChange={(e) =>
                      setSelectedMembers((sel) => (e.target.checked ? [...sel, m.id] : sel.filter((id) => id !== m.id)))
                    }
                  />
                  {m.nickname}
                </label>
              ))}
            </div>
            <button onClick={createGroup} className="w-full rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light">
              Créer le groupe
            </button>
          </div>
        )}

        <nav aria-label="Mes discussions" className="flex flex-col gap-1 overflow-y-auto">
          {channels.map((c) => {
            const partner = c.type === "dm" ? dmPartners.get(c.id) : null;
            const partnerProfile = partner ? Array.from(profiles.values()).find((p) => p.nickname === partner) : null;
            const label = partner ?? channelLabel(c);
            return (
              <button
                key={c.id}
                onClick={() => selectChannel(c.id)}
                aria-current={activeChannel === c.id ? "true" : undefined}
                className={clsx("chat-chan", activeChannel === c.id && "is-active")}
              >
                {c.type === "dm" ? (
                  <Avatar name={label} url={partnerProfile?.avatar_url ?? null} size={36} />
                ) : (
                  <span className="chat-chan-group" aria-hidden>
                    <SidIcon name={c.type === "application" ? "clipboard" : "people"} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="chat-chan-name">{label}</span>
                  <span className="chat-chan-sub">{c.type === "dm" ? "Message privé" : c.type === "application" ? "Candidature" : "Groupe"}</span>
                </span>
              </button>
            );
          })}
        </nav>
        {channels.length === 0 && <p className="px-2 font-body text-sm text-paper/65">Aucune discussion pour l&apos;instant.</p>}
      </aside>

      <section className={clsx("chat-main", activeChannel ? "flex" : "hidden md:flex")}>
        {!activeChannel ? (
          <div className="m-auto flex flex-col items-center gap-3 p-6 text-center">
            <span className="chat-empty-icon" aria-hidden><SidIcon name="chat" size={44} /></span>
            <p className="font-display text-xl uppercase tracking-wide">Aucune discussion ouverte</p>
            <p className="max-w-xs font-body text-sm text-paper/70">Choisis une discussion à gauche, ou commence-en une avec « + Nouvelle ».</p>
          </div>
        ) : (
          <>
            <header className="chat-head">
              <button
                onClick={() => {
                  setActiveChannel(null);
                  router.replace("/dashboard/chat");
                }}
                aria-label="Retour aux discussions"
                className="chat-head-back md:hidden"
              >
                ←
              </button>
              {activeChannelObj?.type === "dm" ? (
                <Avatar name={dmPartners.get(activeChannel) ?? "?"} url={Array.from(profiles.values()).find((p) => p.nickname === dmPartners.get(activeChannel))?.avatar_url ?? null} size={40} />
              ) : (
                <span className="chat-chan-group is-lg" aria-hidden><SidIcon name="people" /></span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg uppercase tracking-wide">{activeChannelObj?.type === "dm" ? dmPartners.get(activeChannel) ?? activeLabel : activeLabel}</h2>
                <p className="font-mono text-[11px] text-paper/65">
                  {isGroup ? (channelParticipantIds.size ? `${channelParticipantIds.size} participants` : "Groupe") : "Message privé"}
                </p>
              </div>
              {isGroup && (
                <button onClick={() => setShowAddMembers((s) => !s)} aria-expanded={showAddMembers} className="chat-head-btn">
                  {showAddMembers ? "Fermer" : "+ Membres"}
                </button>
              )}
            </header>

            {isGroup && showAddMembers && (
              <div className="chat-new mx-3 mt-3 space-y-2">
                <p className="chat-new-label">Ajouter au groupe</p>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {members.filter((m) => !channelParticipantIds.has(m.id)).map((m) => (
                    <label key={m.id} className="flex items-center gap-2 font-body text-sm">
                      <input
                        type="checkbox" className="accent-blue"
                        checked={membersToAdd.includes(m.id)}
                        onChange={(e) =>
                          setMembersToAdd((sel) => (e.target.checked ? [...sel, m.id] : sel.filter((id) => id !== m.id)))
                        }
                      />
                      {m.nickname}
                    </label>
                  ))}
                  {members.filter((m) => !channelParticipantIds.has(m.id)).length === 0 && (
                    <p className="font-body text-xs text-paper/65">Tous les membres actifs sont déjà dans ce groupe.</p>
                  )}
                </div>
                <button
                  onClick={addMembersToChannel}
                  disabled={membersToAdd.length === 0}
                  className="w-full rounded-lg bg-blue px-3 py-1 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            )}

            <div className="chat-scroll" role="log" aria-label={`Messages : ${activeLabel}`}>
              {messages.length === 0 && (
                <p className="m-auto py-10 text-center font-body text-sm text-paper/65">Aucun message. Lance la conversation, ou la scène !</p>
              )}
              {messages.map((m, i) => {
                const isMine = m.sender_id === userId;
                const isEditing = editingId === m.id;
                const d = new Date(m.created_at);
                const prev = messages[i - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== d.toDateString();
                const day = newDay ? (
                  <div className="chat-day" key={`d-${m.id}`}>
                    <span>{dayLabel(d)}</span>
                  </div>
                ) : null;
                const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                const name = profiles.get(m.sender_id)?.nickname ?? "Agent";

                if (m.kind && m.kind !== "say" && !m.is_deleted && !isEditing) {
                  return [
                    day,
                    <RpMessage key={m.id} m={m} name={name} mine={isMine} onDelete={isMine ? () => deleteMessage(m.id) : undefined} />,
                  ];
                }
                if (m.is_deleted) {
                  return [
                    day,
                    <p key={m.id} className={clsx("chat-deleted", isMine && "ml-auto")}>
                      {name} a supprimé un message · {time}
                    </p>,
                  ];
                }
                // Messages d'affilée du même agent (moins de 5 min) : regroupés sous un seul nom.
                const grouped =
                  !newDay && !!prev && prev.sender_id === m.sender_id && (prev.kind ?? "say") === "say" && !prev.is_deleted &&
                  d.getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
                const title = senderTitles.get(m.sender_id);
                return [
                  day,
                  <div key={m.id} className={clsx("chat-row group", isMine ? "is-mine" : "is-other", grouped && "is-grouped")}>
                    {!isMine && (
                      <span className="chat-row-avatar">
                        {!grouped && (
                          <Link href={`/dashboard/profile/${m.sender_id}`} aria-label={`Dossier de ${name}`}>
                            <Avatar name={name} url={profiles.get(m.sender_id)?.avatar_url ?? null} size={34} />
                          </Link>
                        )}
                      </span>
                    )}
                    <div className="chat-bubble-wrap">
                      {!isMine && !grouped && (
                        <span className="chat-author">
                          <Link href={`/dashboard/profile/${m.sender_id}`} className="hover:underline">{name}</Link>
                          {title && <TitleBadge titleId={title.title_id} level={title.level} dragon={title.dragon} size="xs" />}
                        </span>
                      )}
                      <div className={clsx("chat-bubble", isMine ? "is-mine" : "is-other")}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              aria-label="Modifier le message"
                              className="w-full rounded border border-ink/20 bg-paper px-2 py-1 font-body text-sm text-ink outline-none"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <button onClick={() => setEditBold((b) => !b)} className={clsx("rounded border px-1.5 font-bold text-xs", editBold ? "border-ink bg-ink/10" : "border-ink/30")}>G</button>
                              <button onClick={() => setEditItalic((it) => !it)} className={clsx("rounded border px-1.5 text-xs italic", editItalic ? "border-ink bg-ink/10" : "border-ink/30")}>I</button>
                              {COLOR_PRESETS.map((c) => (
                                <button
                                  key={c || "none"}
                                  onClick={() => setEditColor(c)}
                                  title={c || "Aucune couleur"}
                                  aria-label={c ? `Couleur ${c}` : "Aucune couleur"}
                                  className={clsx("h-4 w-4 rounded-full border", editColor === c ? "border-ink" : "border-ink/20")}
                                  style={{ backgroundColor: c || "transparent" }}
                                />
                              ))}
                              <button onClick={saveEdit} className="ml-auto rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] uppercase text-paper">Enregistrer</button>
                              <button onClick={() => setEditingId(null)} className="font-mono text-[10px] uppercase text-ink/75 underline">Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className={clsx("whitespace-pre-wrap break-words font-body text-[0.95rem] leading-snug", m.is_bold && "font-bold", m.is_italic && "italic")}
                            style={m.color ? { color: m.color } : undefined}
                          >
                            {m.content}
                            {m.troll_tag?.kind === "flatterie" && (
                              <span className="ml-1 font-bold not-italic" style={{ color: m.troll_tag.color || "#B23B2E" }} title={`Flatterie obligatoire : une farce de ${m.troll_tag.by}`}>
                                … et {m.troll_tag.by} {m.troll_tag.phrase || "est le meilleur !"} <SidIcon name="masks" />
                              </span>
                            )}
                          </p>
                        )}
                        {!isEditing && (
                          <span className="chat-time">
                            {m.edited_at && "modifié · "}
                            {time}
                          </span>
                        )}
                      </div>
                      {isMine && !isEditing && (
                        <div className="chat-tools">
                          <button onClick={() => startEdit(m)}>Modifier</button>
                          <button onClick={() => deleteMessage(m.id)}>Supprimer</button>
                        </div>
                      )}
                    </div>
                  </div>,
                ];
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="chat-composer">
              <div className="flex flex-wrap items-center gap-1.5">
                <RpBar mode={rpMode} onMode={setRpMode} canNarrate={canNarrate} onRoll={rollDice} />
                <button
                  type="button"
                  onClick={() => setShowFormat((v) => !v)}
                  aria-pressed={showFormat}
                  title="Gras, italique, couleur"
                  className={clsx("rp-mode ml-auto", showFormat && "is-on")}
                >
                  <span className="font-bold">A</span><span className="italic">a</span>
                </button>
                {isAdmin && (
                  <button type="button" onClick={() => setShowCommands((s) => !s)} aria-pressed={showCommands} className={clsx("rp-mode", showCommands && "is-on")} title="Commandes de farce (admins)">
                    <SidIcon name="demon" />
                  </button>
                )}
              </div>
              {showFormat && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setDraftBold((b) => !b)} aria-pressed={draftBold} className={clsx("rounded border px-2 py-0.5 font-mono text-xs font-bold", draftBold ? "border-blue bg-blue/20 text-blue-light" : "border-white/20 text-paper/70")}>G</button>
                  <button type="button" onClick={() => setDraftItalic((it) => !it)} aria-pressed={draftItalic} className={clsx("rounded border px-2 py-0.5 font-mono text-xs italic", draftItalic ? "border-blue bg-blue/20 text-blue-light" : "border-white/20 text-paper/70")}>I</button>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      type="button"
                      key={c || "none"}
                      onClick={() => setDraftColor(c)}
                      title={c || "Aucune couleur"}
                      aria-label={c ? `Couleur ${c}` : "Aucune couleur"}
                      aria-pressed={draftColor === c}
                      className={clsx("h-5 w-5 rounded-full border", draftColor === c ? "border-paper" : "border-white/20")}
                      style={{ backgroundColor: c || "transparent" }}
                    />
                  ))}
                </div>
              )}
              {showCommands && isAdmin && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
                  {TROLL_COMMANDS.filter((c) => c !== "troll").map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft(`/${c}`)}
                      className="rounded border border-blue/40 px-2 py-0.5 font-mono text-[10px] uppercase text-blue-light hover:bg-blue hover:text-ink"
                    >
                      /{c}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDraft("/troll")}
                    className="rounded border border-red/50 px-2 py-0.5 font-mono text-[10px] uppercase text-red hover:bg-red hover:text-ink"
                  >
                    /troll (aléatoire) <SidIcon name="demon" />
                  </button>
                </div>
              )}
              <div className="chat-input-row">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={RP_MODES.find((x) => x.key === rpMode)?.placeholder ?? "Écrire un message…"}
                  aria-label="Message"
                  className={clsx("chat-input", `rp-input-${rpMode}`)}
                />
                <button type="submit" className="chat-send" aria-label="Envoyer" disabled={!draft.trim()}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <path d="M3.4 20.4 21 12 3.4 3.6l.02 6.53L15 12 3.42 13.87z" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="font-body text-paper/60">Chargement…</div>}>
      <ChatInner />
    </Suspense>
  );
}
