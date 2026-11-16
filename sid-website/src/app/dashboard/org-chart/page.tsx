"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import { visibleMembers } from "@/lib/visibility";
import { indexOrg, type OrgChartData, type OrgChartNode } from "@/lib/orgChart";
import { OrgTreeView } from "@/components/org/OrgTreeView";
import { OrgEditor, draftFrom, emptyDraft, type OrgDraft, type OrgGroupOption, type OrgMember } from "@/components/org/OrgEditor";

/**
 * Organigramme (Lot 83). Lecture par org_chart() ; avec « Gérer
 * l'organigramme », un mode Modifier : créer, modifier, déplacer, supprimer.
 */

const FOLD_KEY = "sid-org-replies";
const VIEW_KEY = "sid-org-vue";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export default function OrgChartPage() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<OrgChartData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [styles, setStyles] = useState<Map<string, string>>(new Map());
  const [myId, setMyId] = useState<string | null>(null);
  const [seeAll, setSeeAll] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [groups, setGroups] = useState<OrgGroupOption[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<"tree" | "list">("tree");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OrgDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("org_chart");
    if (e) {
      setLoadError(/org_chart/.test(e.message) ? "Migration 0100 à lancer dans Supabase." : e.message);
      return null;
    }
    const chart = d as OrgChartData;
    setData(chart);
    const ids = Array.from(new Set(chart.nodes.map((n) => n.holder?.id).filter((x): x is string => !!x)));
    if (ids.length) {
      const { data: css } = await supabase.rpc("get_profile_css_for", { p_section: "org_chart", p_user_ids: ids });
      setStyles(new Map(((css ?? []) as { user_id: string; css: string }[]).map((r) => [r.user_id, r.css])));
    } else setStyles(new Map());
    return chart;
  }, [supabase]);

  useEffect(() => {
    setCollapsed(readSet(FOLD_KEY));
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "tree" || v === "list") setLayout(v);
    } catch {}
    (async () => {
      const { profile, permissions } = await loadCurrentUser();
      setMyId(profile?.id ?? null);
      setSeeAll(can(permissions, "manage_users"));
      await load();
    })();
  }, [load]);

  // Listes de choix de la fenêtre d'édition, chargées au premier besoin.
  const loadPickers = useCallback(async () => {
    if (members.length || groups.length) return;
    const [{ data: p }, { data: g }] = await Promise.all([
      supabase.from("profiles").select("id, nickname, is_invisible").eq("status", "active").order("nickname"),
      supabase.from("groups").select("id, name, is_independent_system").order("name"),
    ]);
    setMembers(visibleMembers((p ?? []) as (OrgMember & { is_invisible: boolean | null })[], myId, seeAll));
    setGroups((g ?? []) as OrgGroupOption[]);
  }, [supabase, members.length, groups.length, myId, seeAll]);

  const idx = useMemo(() => indexOrg(data?.nodes ?? []), [data]);
  const canManage = !!data?.can_manage;
  const total = data?.nodes.length ?? 0;
  const vacant = data?.nodes.filter((n) => !n.holder).length ?? 0;
  const mine = myId ? (data?.nodes ?? []).filter((n) => n.holder?.id === myId) : [];

  function toggle(id: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      store(FOLD_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function chooseLayout(v: "tree" | "list") {
    setLayout(v);
    store(VIEW_KEY, v);
  }

  // Déplie les supérieurs d'un poste, l'amène à l'écran et le fait briller.
  function reveal(id: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      let cur = idx.byId.get(id)?.parent_id ?? null;
      while (cur) {
        next.delete(cur);
        cur = idx.byId.get(cur)?.parent_id ?? null;
      }
      store(FOLD_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
    setFlash(id);
    setTimeout(() => document.getElementById(`org-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 60);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 2200);
  }

  async function openEditor(d: OrgDraft) {
    setError(null);
    setDraft(d);
    await loadPickers();
  }

  async function save(d: OrgDraft) {
    setBusy(true);
    setError(null);
    const { data: id, error: e } = await supabase.rpc("org_node_save", {
      p_id: d.id,
      p_label: d.label,
      p_parent: d.parentId || null,
      p_holder: d.holderId || null,
      p_group: d.groupId || null,
      p_description: d.description || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setDraft(null);
    await load();
    if (typeof id === "string") reveal(id);
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("org_node_delete", { p_id: id });
    setBusy(false);
    if (e) return setError(e.message);
    setDraft(null);
    await load();
  }

  async function move(n: OrgChartNode, dir: -1 | 1) {
    setBusy(true);
    const { error: e } = await supabase.rpc("org_node_move", { p_id: n.id, p_dir: dir });
    setBusy(false);
    if (e) return setError(e.message);
    await load();
  }

  const btn = "rounded-lg px-3 py-2 font-display text-xs uppercase tracking-wide";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl uppercase tracking-wide text-red">Organigramme du S.I.D.</h1>
          {data && (
            <p className="font-mono text-xs text-paper/60">
              {total} poste{total > 1 ? "s" : ""} · {vacant} vacant{vacant > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {total > 0 && (
            <div className="org-switch" role="group" aria-label="Affichage">
              <button type="button" aria-pressed={layout === "tree"} onClick={() => chooseLayout("tree")}>
                Arbre
              </button>
              <button type="button" aria-pressed={layout === "list"} onClick={() => chooseLayout("list")}>
                Liste
              </button>
            </div>
          )}
          {collapsed.size > 0 && (
            <button type="button" onClick={() => (setCollapsed(new Set()), store(FOLD_KEY, "[]"))} className={`${btn} border border-white/15 text-paper/80 hover:bg-white/10`}>
              Tout déplier
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => (setEditing((v) => !v), setError(null))}
              aria-pressed={editing}
              className={`${btn} ${editing ? "bg-blue text-ink hover:bg-blue-light" : "bg-red text-ink hover:bg-red-light"}`}
            >
              {editing ? "Terminer" : "Modifier"}
            </button>
          )}
        </div>
      </div>

      {(mine.length > 0 || editing) && (
        <div className="flex flex-wrap items-center gap-2">
          {mine.map((n) => (
            <button key={n.id} type="button" onClick={() => reveal(n.id)} className="org-chip">
              Ton poste : {n.label}
            </button>
          ))}
          {editing && (
            <button type="button" onClick={() => openEditor(emptyDraft(null))} className="org-chip is-add">
              + Poste au sommet
            </button>
          )}
        </div>
      )}

      {editing && error && !draft && <p className="font-mono text-xs text-red">{error}</p>}

      <div className="glass-card p-3 sm:p-5">
        {loadError ? (
          <p className="font-mono text-sm text-red">{loadError}</p>
        ) : !data ? (
          <p className="font-body text-paper/60">Chargement…</p>
        ) : total === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="font-body text-paper/70">L&apos;organigramme est encore vide.</p>
            {canManage && (
              <button type="button" onClick={() => (setEditing(true), openEditor(emptyDraft(null)))} className={`${btn} bg-red text-ink hover:bg-red-light`}>
                Créer le premier poste
              </button>
            )}
          </div>
        ) : (
          <OrgTreeView
            layout={layout}
            idx={idx}
            styles={styles}
            myId={myId}
            collapsed={collapsed}
            onToggle={toggle}
            editing={editing}
            busy={busy}
            flash={flash}
            actions={{
              onEdit: (n) => openEditor(draftFrom(n)),
              onAddChild: (n) => openEditor(emptyDraft(n.id)),
              onMove: move,
            }}
          />
        )}
      </div>

      {draft && (
        <OrgEditor
          draft={draft}
          idx={idx}
          members={members}
          groups={groups}
          busy={busy}
          error={error}
          onSave={save}
          onDelete={remove}
          onClose={() => (setDraft(null), setError(null))}
        />
      )}
    </div>
  );
}
