"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { Quest, QuestDifficulty, QuestVisibility, PermissionKey } from "@/types/database";
import { QuestCard } from "@/components/QuestCard";

const inputClass = "w-full border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-olive";
const labelClass = "font-mono text-xs uppercase tracking-wide text-paper-text/80";

export default function QuestsPage() {
  const supabase = createClient();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    reward: "0",
    difficulty: "D" as QuestDifficulty,
    deadline: "",
    visibility: "members" as QuestVisibility,
  });

  async function refresh() {
    const { data } = await supabase.from("quests").select("*").order("created_at", { ascending: false });
    setQuests(data ?? []);
  }

  useEffect(() => {
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setPermissions(permissions);
      setUserId(profile?.id ?? null);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("quests").insert({
      title: form.title,
      description: form.description,
      reward: Number(form.reward) || 0,
      difficulty: form.difficulty,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      visibility: form.visibility,
      created_by: userId,
    });
    setShowForm(false);
    setForm({ title: "", description: "", reward: "0", difficulty: "D", deadline: "", visibility: "members" });
    refresh();
  }

  async function joinQuest(questId: string) {
    if (!userId) return;
    await supabase.from("quest_participants").insert({ quest_id: questId, user_id: userId });
  }

  const canManage = can(permissions, "manage_quests");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-brass">Panneau des quêtes</h1>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-brass px-4 py-2 font-display text-sm uppercase text-ink hover:bg-brass-light"
          >
            {showForm ? "Annuler" : "Nouvelle quête"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="dossier-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
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
            <label className={labelClass}>Échéance</label>
            <input type="date" className={inputClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Visibilité</label>
            <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as QuestVisibility })}>
              <option value="public">Publique (visible hors du site)</option>
              <option value="members">Membres</option>
              <option value="private">Privée</option>
            </select>
          </div>
          <button type="submit" className="sm:col-span-2 bg-olive py-2 font-display uppercase text-paper hover:bg-olive-light">
            Publier la quête
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((q) => (
          <div key={q.id} className="space-y-2">
            <QuestCard quest={q} />
            {!canManage && q.status === "open" && (
              <button
                onClick={() => joinQuest(q.id)}
                className="w-full border border-brass py-1 font-mono text-xs uppercase text-brass hover:bg-brass hover:text-ink"
              >
                Rejoindre la mission
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
