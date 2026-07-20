"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ChatChannel, ChatMessage, Profile } from "@/types/database";

function ChatInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [activeChannel, setActiveChannel] = useState<string | null>(searchParams.get("channel"));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refreshChannels(uid: string) {
    const { data: parts } = await supabase.from("chat_participants").select("channel_id").eq("user_id", uid);
    const ids = (parts ?? []).map((p) => p.channel_id);
    if (ids.length === 0) {
      setChannels([]);
      return;
    }
    const { data: chans } = await supabase.from("chat_channels").select("*").in("id", ids).order("created_at", { ascending: false });
    setChannels(chans ?? []);
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
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeChannel || !userId) return;
    const { error } = await supabase.from("chat_messages").insert({ channel_id: activeChannel, sender_id: userId, content: draft.trim() });
    if (error) {
      setMessage(`Message non envoyé : ${error.message}`);
      return;
    }
    setDraft("");
  }

  async function startDirectMessage(otherId: string) {
    if (!userId) return;
    setMessage(null);
    // cherche un DM existant entre les deux
    const { data: myChannels } = await supabase.from("chat_participants").select("channel_id").eq("user_id", userId);
    const myIds = (myChannels ?? []).map((c) => c.channel_id);
    const { data: theirChannels } = await supabase.from("chat_participants").select("channel_id").eq("user_id", otherId).in("channel_id", myIds);
    let channelId = theirChannels?.[0]?.channel_id as string | undefined;

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

    // Tous les salons de groupe sont espionnables par défaut (jamais les DM,
    // c'est bloqué en base) — un badge 🕵 reste visible en permanence pour
    // les participants du salon.
    const { data: channel, error: channelError } = await supabase
      .from("chat_channels")
      .insert({ type: "group", name: groupName, created_by: userId, spy_eligible: true })
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

  function selectChannel(id: string) {
    setActiveChannel(id);
    router.replace(`/dashboard/chat?channel=${id}`);
  }

  function channelLabel(c: ChatChannel) {
    if (c.type === "group" || c.type === "application") return c.name ?? "Discussion";
    return "Message privé";
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-64 shrink-0 space-y-2 overflow-y-auto">
        <button onClick={() => setShowNew((s) => !s)} className="rounded-lg w-full bg-red px-3 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
          {showNew ? "Annuler" : "Nouvelle discussion"}
        </button>

        {message && <p className="rounded-lg bg-red/10 px-2 py-1 font-mono text-xs text-red">{message}</p>}

        {showNew && (
          <div className="dossier-card space-y-3 p-3">
            <p className="font-mono text-xs uppercase text-paper-text/60">Message privé</p>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {members.filter((m) => m.id !== userId).map((m) => (
                <button key={m.id} onClick={() => startDirectMessage(m.id)} className="block w-full rounded px-2 py-1 text-left font-body text-sm hover:bg-paper-dark">
                  {m.nickname}
                </button>
              ))}
            </div>
            <p className="border-t border-paper-dark pt-2 font-mono text-xs uppercase text-paper-text/60">Groupe (🕵 espionnable par défaut)</p>
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
            {channelLabel(c)} {c.spy_eligible && <span title="Salon espionnable">🕵</span>}
          </button>
        ))}
        {channels.length === 0 && <p className="px-2 font-body text-sm text-paper/50">Aucune discussion pour l&apos;instant.</p>}
      </aside>

      <section className="dossier-card flex flex-1 flex-col p-4">
        {!activeChannel ? (
          <p className="m-auto font-body text-paper-text/60">Sélectionne une discussion.</p>
        ) : (
          <>
            {(() => {
              const current = channels.find((c) => c.id === activeChannel);
              if (!current?.spy_eligible) return null;
              return (
                <div className="rounded-lg mb-2 border border-red/40 bg-red/10 px-3 py-1 font-mono text-xs text-red">
                  🕵 Ce salon est marqué espionnable : des messages peuvent être vus par un espion caché de la S.I.D.
                </div>
              );
            })()}
            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-md rounded-lg px-3 py-2 ${m.sender_id === userId ? "ml-auto bg-blue text-ink" : "bg-paper-dark text-ink"}`}>
                  {m.sender_id !== userId && (
                    <p className="font-mono text-[10px] uppercase text-paper-text/60">{profiles.get(m.sender_id)?.nickname ?? "Agent"}</p>
                  )}
                  <p className="font-body text-sm">{m.content}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={sendMessage} className="mt-3 flex gap-2 border-t border-paper-dark pt-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un message…"
                className="rounded-lg flex-1 border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-blue"
              />
              <button type="submit" className="rounded-lg bg-red px-4 font-display text-sm uppercase text-ink hover:bg-red-light">
                Envoyer
              </button>
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
