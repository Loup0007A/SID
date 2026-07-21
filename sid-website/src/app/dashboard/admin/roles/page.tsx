"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import type { Role, Group, Profile, PermissionKey, QuestDifficulty } from "@/types/database";
import { inputClass, labelClass } from "@/lib/ui";

const ALL_PERMISSIONS: PermissionKey[] = [
  "manage_roles",
  "manage_org_chart",
  "manage_quests",
  "manage_shop",
  "manage_teams",
  "manage_economy",
  "recruit",
  "manage_users",
  "manage_espionage",
];


export default function RolesAdminPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePerms, setRolePerms] = useState<Map<string, Set<PermissionKey>>>(new Map());
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"org_branch" | "quest_team" | "guild_team" | "other">("other");
  const [newGroupIndependent, setNewGroupIndependent] = useState(false);
  const [assignUser, setAssignUser] = useState("");
  const [assignRole, setAssignRole] = useState("");

  async function refresh() {
    const [{ data: r }, { data: rp }, { data: g }, { data: m }] = await Promise.all([
      supabase.from("roles").select("*").order("rank", { ascending: false }),
      supabase.from("role_permissions").select("*"),
      supabase.from("groups").select("*"),
      supabase.from("profiles").select("*").eq("status", "active"),
    ]);
    setRoles(r ?? []);
    setGroups(g ?? []);
    setMembers(m ?? []);

    const map = new Map<string, Set<PermissionKey>>();
    (rp ?? []).forEach((row) => {
      const set = map.get(row.role_id) ?? new Set<PermissionKey>();
      set.add(row.permission);
      map.set(row.role_id, set);
    });
    setRolePerms(map);
  }

  useEffect(() => {
    (async () => {
      const { permissions } = await loadCurrentUser();
      setPermissions(permissions);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function togglePermission(roleId: string, perm: PermissionKey, enabled: boolean) {
    if (enabled) {
      await supabase.from("role_permissions").insert({ role_id: roleId, permission: perm });
    } else {
      await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission", perm);
    }
    refresh();
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    await supabase.from("roles").insert({ name: newRoleName });
    setNewRoleName("");
    refresh();
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await supabase.from("groups").insert({
      name: newGroupName,
      type: newGroupType,
      is_independent_system: newGroupIndependent,
    });
    setNewGroupName("");
    setNewGroupIndependent(false);
    refresh();
  }

  async function assignRoleToUser(e: React.FormEvent) {
    e.preventDefault();
    if (!assignUser || !assignRole) return;
    await supabase.from("user_roles").insert({ user_id: assignUser, role_id: assignRole });
    setAssignUser("");
    setAssignRole("");
    refresh();
  }

  async function changeRank(userId: string, rank: QuestDifficulty) {
    await supabase.from("profiles").update({ member_rank: rank }).eq("id", userId);
    refresh();
  }

  const canUsers = can(permissions, "manage_users");

  const canRoles = can(permissions, "manage_roles");
  const canTeams = can(permissions, "manage_teams");

  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Rôles &amp; équipes</h1>

      {canRoles && (
        <section className="space-y-4">
          <h2 className="font-display text-lg uppercase text-paper">Rôles &amp; permissions</h2>

          <form onSubmit={createRole} className="flex gap-2">
            <input className={inputClass} placeholder="Nom du nouveau rôle" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
            <button className="rounded-lg bg-blue px-4 font-display text-sm uppercase text-ink hover:bg-blue-light">Créer</button>
          </form>

          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="glass-card p-4">
                <p className="mb-2 font-display uppercase" style={{ color: role.color }}>{role.name}</p>
                <div className="flex flex-wrap gap-3">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = rolePerms.get(role.id)?.has(perm) ?? false;
                    return (
                      <label key={perm} className="flex items-center gap-1 font-mono text-xs">
                        <input
                          type="checkbox" className="accent-blue"
                          checked={checked}
                          onChange={(e) => togglePermission(role.id, perm, e.target.checked)}
                        />
                        {perm}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={assignRoleToUser} className="glass-card flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <label className={labelClass}>Membre</label>
              <select className={inputClass} value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
                <option value="">Choisir…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.nickname}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Rôle</label>
              <select className={inputClass} value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
                <option value="">Choisir…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <button className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light">Attribuer</button>
          </form>
        </section>
      )}

      {canUsers && (
        <section className="space-y-4">
          <h2 className="font-display text-lg uppercase text-paper">Rangs des membres</h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="glass-card flex items-center justify-between gap-3 p-3">
                <span className="font-body">{m.nickname}</span>
                <select
                  className={`${inputClass} w-24`}
                  value={m.member_rank}
                  onChange={(e) => changeRank(m.id, e.target.value as QuestDifficulty)}
                >
                  {["E", "D", "C", "B", "A", "S"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {canTeams && (
        <section className="space-y-4">
          <h2 className="font-display text-lg uppercase text-paper">Équipes &amp; systèmes</h2>
          <form onSubmit={createGroup} className="glass-card flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1">
              <label className={labelClass}>Nom</label>
              <input className={inputClass} value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Type</label>
              <select className={inputClass} value={newGroupType} onChange={(e) => setNewGroupType(e.target.value as typeof newGroupType)}>
                <option value="org_branch">Branche de l&apos;organigramme</option>
                <option value="quest_team">Équipe de mission</option>
                <option value="guild_team">Équipe de guilde</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <label className="flex items-center gap-2 font-mono text-xs">
              <input type="checkbox" className="accent-blue" checked={newGroupIndependent} onChange={(e) => setNewGroupIndependent(e.target.checked)} />
              Système indépendant
            </label>
            <button className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light">Créer</button>
          </form>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.id} className="glass-card p-4">
                <p className="font-display uppercase">{g.name}</p>
                <p className="font-mono text-xs text-paper/60">{g.type}{g.is_independent_system ? " · système indépendant" : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
