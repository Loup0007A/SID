"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { OrgNode, Profile, Group, PermissionKey } from "@/types/database";
import { OrgTree } from "@/components/OrgTree";
import { inputClass, labelClass } from "@/lib/ui";


export default function OrgChartPage() {
  const supabase = createClient();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [groups, setGroups] = useState<Map<string, Group>>(new Map());
  const [groupList, setGroupList] = useState<Group[]>([]);
  const [profileList, setProfileList] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", parentId: "", holderId: "", groupId: "" });

  async function refresh() {
    const [{ data: n }, { data: p }, { data: g }] = await Promise.all([
      supabase.from("org_nodes").select("*"),
      supabase.from("profiles").select("*").eq("status", "active"),
      supabase.from("groups").select("*"),
    ]);
    setNodes(n ?? []);
    setProfileList(p ?? []);
    setProfiles(new Map((p ?? []).map((x) => [x.id, x])));
    setGroupList(g ?? []);
    setGroups(new Map((g ?? []).map((x) => [x.id, x])));
  }

  useEffect(() => {
    (async () => {
      const { permissions } = await loadCurrentUser();
      setPermissions(permissions);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canManage = can(permissions, "manage_org_chart");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("org_nodes").insert({
      label: form.label,
      parent_id: form.parentId || null,
      holder_id: form.holderId || null,
      group_id: form.groupId || null,
    });
    setForm({ label: "", parentId: "", holderId: "", groupId: "" });
    setShowForm(false);
    refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from("org_nodes").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Organigramme de la S.I.D.</h1>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">
            {showForm ? "Annuler" : "Ajouter un poste"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Titre du poste</label>
            <input required className={inputClass} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Poste supérieur</label>
            <select className={inputClass} value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">— Sommet de la hiérarchie —</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Titulaire</label>
            <select className={inputClass} value={form.holderId} onChange={(e) => setForm({ ...form, holderId: e.target.value })}>
              <option value="">— Poste vacant —</option>
              {profileList.map((p) => (
                <option key={p.id} value={p.id}>{p.nickname}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Système / équipe rattaché</label>
            <select className={inputClass} value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
              <option value="">— Aucun —</option>
              {groupList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.is_independent_system ? "(système indépendant)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg sm:col-span-2 bg-blue py-2 font-display uppercase text-ink hover:bg-blue-light">
            Ajouter à l&apos;organigramme
          </button>
        </form>
      )}

      <div className="glass-card overflow-x-auto p-6">
        <OrgTree nodes={nodes} profiles={profiles} groups={groups} parentId={null} onDelete={canManage ? handleDelete : undefined} canManage={canManage} />
        {nodes.length === 0 && <p className="font-body text-paper/60">L&apos;organigramme est encore vide.</p>}
      </div>
    </div>
  );
}
