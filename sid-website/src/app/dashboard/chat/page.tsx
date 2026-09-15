"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { ChatChannel, ChatMessage, Profile, DmPartner } from "@/types/database";
import { isTrollCommand, playTrollEffect, TROLL_COMMANDS } from "@/lib/trollEffects";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
    const { data: parts } = await supabase.from("chat_participants").select("channel_id").eq("user_id", uid);
    const ids = (parts ?? []).map((p) => p.channel_id);
    if (ids.length === 0) {
      setChannels([]);
      return;
    }
    const { data: chans } = await supabase.from("chat_channels").select("*").in("id", ids).order("created_at", { ascending: false });
    setChannels(chans ?? []);

    const { data: partners } = await supabase.rpc("list_dm_partner_names");
    setDmPartners(new Map(((partners ?? []) as DmPartner[]).map((p) => [p.channel_id, p.partner_nickname])));
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: m } = await supabase.from("profiles").select("*").eq("status", "active");
      setMembers(m ?? []);
      setProfiles(new Map((m ?? []).map((p) => [p.id, p])));

      await refreshChannels(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeChannel) return;

    async function loadMessages() {
      const { data } = await supabase.from("chat_messages").select("*").eq("channel_id", activeChannel).order("created_at", { ascending: true });
      setMessages(data ?? []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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

    const { error } = await supabase.from("chat_messages").insert({
      channel_id: activeChannel,
      sender_id: userId,
      content: trimmed,
      is_bold: draftBold,
      is_italic: draftItalic,
      color: draftColor || null,
    });
    if (error) {
      setMessage(`Message non envoyé : ${error.message}`);
      return;
    }
    setDraft("");
  }

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

  return (
    <div className="flex h-[calc(100dvh-9rem)] gap-4 sm:h-[calc(100dvh-10rem)]">
      <aside className={clsx("w-full flex-col shrink-0 space-y-2 overflow-y-auto md:flex md:w-64", activeChannel ? "hidden md:flex" : "flex")}>
        <button onClick={() => setShowNew((s) => !s)} className="rounded-lg w-full bg-red px-3 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
          {showNew ? "Annuler" : "Nouvelle discussion"}
        </button>

        {message && <p className="rounded-lg bg-red/10 px-2 py-1 font-mono text-xs text-red">{message}</p>}

        {showNew && (
          <div className="glass-card space-y-3 p-3">
            <p className="font-mono text-xs uppercase text-paper/60">Message privé</p>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {members.filter((m) => m.id !== userId).map((m) => (
                <button key={m.id} onClick={() => startDirectMessage(m.id)} className="block w-full rounded px-2 py-1 text-left font-body text-sm hover:bg-paper-dark">
                  {m.nickname}
                </button>
              ))}
            </div>
            <p className="border-t border-white/10 pt-2 font-mono text-xs uppercase text-paper/60">Groupe</p>
            <input
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="rounded-lg w-full border border-paper-dark bg-paper px-2 py-1 font-body text-sm text-ink"
            />
            <div className="max-h-24 space-y-1 overflow-y-auto">
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
            <button onClick={createGroup} className="rounded-lg w-full bg-blue px-3 py-1 font-mono text-xs uppercase text-ink hover:bg-blue-light">
              Créer le groupe
            </button>
          </div>
        )}

        {channels.map((c) => (
          <button
            key={c.id}
            onClick={() => selectChannel(c.id)}
            className={`block w-full rounded px-3 py-2 text-left font-mono text-sm ${
              activeChannel === c.id ? "bg-ink-border text-red" : "hover:bg-ink-border"
            }`}
          >
            {channelLabel(c)}
          </button>
        ))}
        {channels.length === 0 && <p className="px-2 font-body text-sm text-paper/50">Aucune discussion pour l&apos;instant.</p>}
      </aside>

      <section className={clsx("glass-card flex-1 flex-col p-4 md:flex", activeChannel ? "flex" : "hidden md:flex")}>
        {!activeChannel ? (
          <p className="m-auto font-body text-paper/60">Sélectionne une discussion.</p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setActiveChannel(null);
                  router.replace("/dashboard/chat");
                }}
                className="flex items-center gap-1 font-mono text-xs uppercase text-paper/60 hover:text-blue-light md:hidden"
              >
                ← Retour aux discussions
              </button>
              {isGroup && (
                <button
                  onClick={() => setShowAddMembers((s) => !s)}
                  className="ml-auto rounded-lg border border-blue px-3 py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
                >
                  {showAddMembers ? "Annuler" : "Ajouter des membres"}
                </button>
              )}
            </div>

            {isGroup && showAddMembers && (
              <div className="glass-card mb-3 space-y-2 p-3">
                <p className="font-mono text-xs uppercase text-paper/60">Ajouter au groupe</p>
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
                    <p className="font-body text-xs text-paper/50">Tous les membres actifs sont déjà dans ce groupe.</p>
                  )}
                </div>
                <button
                  onClick={addMembersToChannel}
                  disabled={membersToAdd.length === 0}
                  className="rounded-lg w-full bg-blue px-3 py-1 font-mono text-xs uppercase text-ink hover:bg-blue-light disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {messages.map((m) => {
                const isMine = m.sender_id === userId;
                const isEditing = editingId === m.id;
                return (
                  <div key={m.id} className={`group max-w-[85%] sm:max-w-md rounded-lg px-3 py-2 ${isMine ? "ml-auto bg-blue text-ink" : "bg-paper-dark text-ink"}`}>
                    {!isMine && (
                      <Link
                        href={`/dashboard/profile/${m.sender_id}`}
                        className="font-mono text-[10px] uppercase text-paper/60 hover:text-blue-light hover:underline"
                      >
                        {profiles.get(m.sender_id)?.nickname ?? "Agent"}
                      </Link>
                    )}

                    {m.is_deleted ? (
                      <p className="font-body text-sm italic text-ink/50">Message supprimé</p>
                    ) : isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded border border-ink/20 bg-paper px-2 py-1 font-body text-sm text-ink outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => setEditBold((b) => !b)} className={clsx("rounded border px-1.5 font-bold text-xs", editBold ? "border-ink bg-ink/10" : "border-ink/30")}>G</button>
                          <button onClick={() => setEditItalic((i) => !i)} className={clsx("rounded border px-1.5 text-xs italic", editItalic ? "border-ink bg-ink/10" : "border-ink/30")}>I</button>
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c || "none"}
                              onClick={() => setEditColor(c)}
                              title={c || "Aucune couleur"}
                              className={clsx("h-4 w-4 rounded-full border", editColor === c ? "border-ink" : "border-ink/20")}
                              style={{ backgroundColor: c || "transparent" }}
                            />
                          ))}
                          <button onClick={saveEdit} className="ml-auto rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] uppercase text-paper">Enregistrer</button>
                          <button onClick={() => setEditingId(null)} className="font-mono text-[10px] uppercase text-ink/60 underline">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={clsx("font-body text-sm", m.is_bold && "font-bold", m.is_italic && "italic")}
                        style={m.color ? { color: m.color } : undefined}
                      >
                        {m.content}
                        {m.edited_at && <span className="ml-1 font-mono text-[10px] opacity-60">(modifié)</span>}
                      </p>
                    )}

                    {isMine && !m.is_deleted && !isEditing && (
                      <div className="mt-1 hidden gap-2 group-hover:flex">
                        <button onClick={() => startEdit(m)} className="font-mono text-[10px] uppercase text-ink/70 underline">Modifier</button>
                        <button onClick={() => deleteMessage(m.id)} className="font-mono text-[10px] uppercase text-ink/70 underline">Supprimer</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="mt-3 space-y-2 border-t border-white/10 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setDraftBold((b) => !b)} className={clsx("rounded border px-2 py-0.5 font-mono text-xs font-bold", draftBold ? "border-blue bg-blue/20 text-blue-light" : "border-white/20 text-paper/70")}>G</button>
                <button type="button" onClick={() => setDraftItalic((i) => !i)} className={clsx("rounded border px-2 py-0.5 font-mono text-xs italic", draftItalic ? "border-blue bg-blue/20 text-blue-light" : "border-white/20 text-paper/70")}>I</button>
                {COLOR_PRESETS.map((c) => (
                  <button
                    type="button"
                    key={c || "none"}
                    onClick={() => setDraftColor(c)}
                    title={c || "Aucune couleur"}
                    className={clsx("h-5 w-5 rounded-full border", draftColor === c ? "border-paper" : "border-white/20")}
                    style={{ backgroundColor: c || "transparent" }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowCommands((s) => !s)}
                  className="ml-auto rounded border border-white/20 px-2 py-0.5 font-mono text-xs text-paper/70 hover:border-blue hover:text-blue-light"
                  title="Commandes disponibles"
                >
                  😈 /commandes
                </button>
              </div>
              {showCommands && (
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
                    /troll (aléatoire) 😈
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Écrire un message…"
                  className="rounded-lg flex-1 border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-blue"
                />
                <button type="submit" className="rounded-lg bg-red px-4 font-display text-sm uppercase text-ink hover:bg-red-light">
                  Envoyer
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
