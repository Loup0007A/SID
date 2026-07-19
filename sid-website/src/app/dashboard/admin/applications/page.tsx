"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const inputClass = "w-full border border-paper-dark bg-paper px-3 py-2 font-body text-ink outline-none focus:border-blue text-sm";
const labelClass = "font-mono text-xs uppercase tracking-wide text-paper-text/80";

export default function ApplicationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [applications, setApplications] = useState<Profile[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Profile>>>({});

  async function refresh() {
    const { data } = await supabase.from("profiles").select("*").eq("status", "pending").order("created_at", { ascending: true });
    setApplications(data ?? []);
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateEdit(id: string, field: keyof Profile, value: string) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));
  }

  async function saveDetails(id: string) {
    const patch = edits[id];
    if (!patch) return;
    await supabase.from("profiles").update(patch).eq("id", id);
    refresh();
  }

  async function decide(id: string, approve: boolean) {
    await supabase.rpc("review_application", { p_user_id: id, p_approve: approve });
    refresh();
  }

  async function openChat(candidateId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("chat_channels")
      .select("id")
      .eq("type", "application")
      .eq("related_application_id", candidateId)
      .maybeSingle();

    let channelId = existing?.id as string | undefined;

    if (!channelId) {
      const { data: channel } = await supabase
        .from("chat_channels")
        .insert({ type: "application", name: "Candidature", related_application_id: candidateId, created_by: user.id })
        .select()
        .single();
      channelId = channel?.id;

      if (channelId) {
        await supabase.from("chat_participants").insert([
          { channel_id: channelId, user_id: user.id },
          { channel_id: channelId, user_id: candidateId },
        ]);
      }
    }

    if (channelId) router.push(`/dashboard/chat?channel=${channelId}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Candidatures en attente</h1>

      {applications.length === 0 && <p className="font-body text-paper/60">Aucune candidature en attente.</p>}

      <div className="space-y-6">
        {applications.map((a) => {
          const edit = edits[a.id] ?? {};
          return (
            <div key={a.id} className="dossier-card grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClass}>Nom IRL</label>
                <p className="font-body">{a.first_name} {a.last_name}</p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Âge</label>
                <p className="font-body">{a.age ?? "—"}</p>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Surnom</label>
                <input className={inputClass} defaultValue={a.nickname} onChange={(e) => updateEdit(a.id, "nickname", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Rôle voulu</label>
                <input className={inputClass} defaultValue={a.desired_role ?? ""} onChange={(e) => updateEdit(a.id, "desired_role", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Armes</label>
                <input className={inputClass} defaultValue={a.weapons ?? ""} onChange={(e) => updateEdit(a.id, "weapons", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Équipement</label>
                <input className={inputClass} defaultValue={a.equipment ?? ""} onChange={(e) => updateEdit(a.id, "equipment", e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea rows={3} className={inputClass} defaultValue={a.description ?? ""} onChange={(e) => updateEdit(a.id, "description", e.target.value)} />
              </div>

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button onClick={() => saveDetails(a.id)} className="border border-blue px-4 py-2 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-paper">
                  Enregistrer les modifications
                </button>
                <button onClick={() => openChat(a.id)} className="border border-red px-4 py-2 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink">
                  Discuter avec le candidat
                </button>
                <button onClick={() => decide(a.id, true)} className="bg-blue px-4 py-2 font-mono text-xs uppercase text-paper hover:bg-blue-light">
                  Accepter
                </button>
                <button onClick={() => decide(a.id, false)} className="bg-red px-4 py-2 font-mono text-xs uppercase text-paper hover:opacity-90">
                  Refuser
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
