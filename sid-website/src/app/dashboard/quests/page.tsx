"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { Quest, QuestDifficulty, QuestVisibility, ContractType, PermissionKey, Profile, QuestParticipantView } from "@/types/database";
import { QuestCard } from "@/components/QuestCard";
import { inputClass, labelClass } from "@/lib/ui";
import { CONTRACT_TYPES } from "@/lib/contractTypes";

export default function QuestsPage() {
  const supabase = createClient();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [myQuestIds, setMyQuestIds] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    reward: "0",
    difficulty: "D" as QuestDifficulty,
    contractType: "autres" as ContractType,
    deadline: "",
    visibility: "members" as QuestVisibility,
    maxParticipants: "",
  });

  // "Pour qui je prends cette mission" par quête (avant de cliquer sur "Prendre")
  const [beneficiary, setBeneficiary] = useState<Record<string, "self" | string>>({});

  // Panneau de gestion des participants (managers uniquement)
  const [openParticipants, setOpenParticipants] = useState<string | null>(null);
  const [participants, setParticipants] = useState<QuestParticipantView[]>([]);

  async function refresh(uid?: string | null) {
    const activeUserId = uid !== undefined ? uid : userId;

    const { data, error } = await supabase.from("quests").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage(`Impossible de charger les quêtes : ${error.message}`);
      return;
    }
    setQuests(data ?? []);

    const { data: countsData } = await supabase.rpc("quest_participant_counts");
    setCounts(new Map(((countsData ?? []) as { quest_id: string; participant_count: number }[]).map((c) => [c.quest_id, c.participant_count])));

    if (activeUserId) {
      const { data: mine } = await supabase.from("quest_participants").select("quest_id").eq("user_id", activeUserId);
      setMyQuestIds(new Set((mine ?? []).map((m) => m.quest_id)));
    }
  }

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setPermissions(permissions);
      setUserId(profile?.id ?? null);
      const { data: m } = await supabase.from("profiles").select("*").eq("status", "active");
      setMembers(m ?? []);
      await refresh(profile?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.from("quests").insert({
      title: form.title,
      description: form.description,
      reward: Number(form.reward) || 0,
      difficulty: form.difficulty,
      contract_type: form.contractType,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      visibility: form.visibility,
      max_participants: form.maxParticipants ? Number(form.maxParticipants) : null,
      created_by: userId,
    });
    if (error) {
      setMessage(`Échec de la création : ${error.message}`);
      return;
    }
    setShowForm(false);
    setForm({ title: "", description: "", reward: "0", difficulty: "D", contractType: "autres", deadline: "", visibility: "members", maxParticipants: "" });
    await refresh();
  }

  async function joinQuest(quest: Quest) {
    if (!userId) return;
    const currentCount = counts.get(quest.id) ?? 0;
    if (quest.max_participants != null && currentCount >= quest.max_participants) {
      setMessage("Cette mission est déjà complète.");
      return;
    }
    const choice = beneficiary[quest.id] ?? "self";
    const rewardRecipientId = choice === "self" ? null : choice;

    const { error } = await supabase
      .from("quest_participants")
      .insert({ quest_id: quest.id, user_id: userId, reward_recipient_id: rewardRecipientId });
    if (error) {
      setMessage(`Impossible de prendre la mission : ${error.message}`);
      return;
    }
    setMessage(rewardRecipientId ? "Mission prise ! Récompense reversée à un autre agent." : "Mission prise !");
    await refresh();
  }

  async function deleteQuest(id: string) {
    if (!confirm("Supprimer définitivement cette quête ?")) return;
    const { error } = await supabase.from("quests").delete().eq("id", id);
    if (error) {
      setMessage(`Impossible de supprimer : ${error.message}`);
      return;
    }
    await refresh();
  }

  async function toggleParticipants(questId: string) {
    if (openParticipants === questId) {
      setOpenParticipants(null);
      return;
    }
    setOpenParticipants(questId);
    const { data, error } = await supabase.rpc("list_quest_participants", { p_quest_id: questId });
    if (error) {
      setMessage(`Impossible de charger les participants : ${error.message}`);
      return;
    }
    setParticipants((data ?? []) as QuestParticipantView[]);
  }

  async function validateOne(questId: string, participantUserId: string) {
    const { error } = await supabase.rpc("validate_quest_participant", { p_quest_id: questId, p_user_id: participantUserId });
    if (error) {
      setMessage(`Échec de la validation : ${error.message}`);
      return;
    }
    await toggleParticipantsForceReload(questId);
    await refresh();
  }

  async function validateAll(questId: string) {
    if (!confirm("Valider cette quête pour TOUS les participants inscrits et la marquer comme terminée ?")) return;
    const { data, error } = await supabase.rpc("validate_quest_all_participants", { p_quest_id: questId });
    if (error) {
      setMessage(`Échec de la validation groupée : ${error.message}`);
      return;
    }
    setMessage(`${data ?? 0} participant(s) récompensé(s), quête marquée comme terminée.`);
    await toggleParticipantsForceReload(questId);
    await refresh();
  }

  async function toggleParticipantsForceReload(questId: string) {
    const { data } = await supabase.rpc("list_quest_participants", { p_quest_id: questId });
    setParticipants((data ?? []) as QuestParticipantView[]);
  }

  const canManage = can(permissions, "manage_quests");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Panneau des quêtes</h1>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light"
          >
            {showForm ? "Annuler" : "Nouvelle quête"}
          </button>
        )}
      </div>

      <div className="glass-panel flex flex-wrap gap-x-4 gap-y-2 rounded-lg px-4 py-3">
        {CONTRACT_TYPES.map((t) => (
          <span key={t.value} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-paper/70">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
      </div>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Titre</label>
            <input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Récompense</label>
            <input type="number" min={0} className={inputClass} value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Rang</label>
            <select className={inputClass} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as QuestDifficulty })}>
              {["E", "D", "C", "B", "A", "S"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Type de contrat</label>
            <select className={inputClass} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Échéance</label>
            <input type="date" className={inputClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Nombre de places (vide = illimité)</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.maxParticipants}
              onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Visibilité</label>
            <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as QuestVisibility })}>
              <option value="public">Publique (visible hors du site)</option>
              <option value="members">Membres</option>
              <option value="private">Privée</option>
            </select>
          </div>
          <button type="submit" className="rounded-lg sm:col-span-2 bg-blue py-2 font-display uppercase text-ink hover:bg-blue-light">
            Publier la quête
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((q) => {
          const count = counts.get(q.id) ?? 0;
          const isFull = q.max_participants != null && count >= q.max_participants;
          const alreadyIn = myQuestIds.has(q.id);
          return (
            <div key={q.id} className="space-y-2">
              <QuestCard quest={q} participantCount={count} />

              {!canManage && q.status === "open" && !alreadyIn && (
                <div className="glass-card space-y-2 p-3">
                  <label className={labelClass}>Récompense pour…</label>
                  <select
                    className={inputClass}
                    value={beneficiary[q.id] ?? "self"}
                    onChange={(e) => setBeneficiary((b) => ({ ...b, [q.id]: e.target.value }))}
                  >
                    <option value="self">Moi-même</option>
                    {members.filter((m) => m.id !== userId).map((m) => (
                      <option key={m.id} value={m.id}>{m.nickname}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => joinQuest(q)}
                    disabled={isFull}
                    className="rounded-lg w-full border border-red py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isFull ? "Complète" : "Prendre la mission"}
                  </button>
                </div>
              )}

              {!canManage && alreadyIn && (
                <p className="rounded-lg w-full border border-blue/60 py-1 text-center font-mono text-xs uppercase text-blue-light">
                  Déjà prise
                </p>
              )}

              {canManage && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleParticipants(q.id)}
                      className="rounded-lg flex-1 border border-blue py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
                    >
                      {openParticipants === q.id ? "Masquer les participants" : "Gérer les participants"}
                    </button>
                    <button
                      onClick={() => deleteQuest(q.id)}
                      className="rounded-lg flex-1 border border-red/50 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                    >
                      Supprimer
                    </button>
                  </div>

                  {openParticipants === q.id && (
                    <div className="glass-card space-y-2 p-3">
                      {participants.length === 0 ? (
                        <p className="font-body text-xs text-paper/60">Aucun participant inscrit.</p>
                      ) : (
                        <>
                          {participants.map((p) => (
                            <div key={p.user_id} className="flex items-center justify-between gap-2 font-mono text-xs">
                              <span>
                                {p.nickname}
                                {p.reward_recipient_nickname && (
                                  <span className="text-paper/60"> → {p.reward_recipient_nickname}</span>
                                )}
                                {p.status === "validated" && <span className="ml-1 text-blue-light">(validé)</span>}
                              </span>
                              {p.status !== "validated" && (
                                <button
                                  onClick={() => validateOne(q.id, p.user_id)}
                                  className="rounded border border-blue px-2 py-0.5 uppercase text-blue hover:bg-blue hover:text-ink"
                                >
                                  Valider
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => validateAll(q.id)}
                            className="rounded-lg w-full bg-blue py-1 font-mono text-xs uppercase text-ink hover:bg-blue-light"
                          >
                            Tout valider (marque la quête terminée)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
