"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass, labelClass } from "@/lib/ui";
import { descendantsOf, flattenOrg, kidsOf, type OrgChartNode, type OrgIndex } from "@/lib/orgChart";

/**
 * Fenêtre de création / modification d'un poste (Lot 83). La suppression se
 * confirme ici, en disant où remontent les sous-postes.
 */

export type OrgDraft = { id: string | null; label: string; description: string; parentId: string; holderId: string; groupId: string };
export type OrgMember = { id: string; nickname: string };
export type OrgGroupOption = { id: string; name: string; is_independent_system: boolean };

export const draftFrom = (n: OrgChartNode): OrgDraft => ({
  id: n.id,
  label: n.label,
  description: n.description ?? "",
  parentId: n.parent_id ?? "",
  holderId: n.holder?.id ?? "",
  groupId: n.group?.id ?? "",
});

export const emptyDraft = (parentId: string | null): OrgDraft => ({ id: null, label: "", description: "", parentId: parentId ?? "", holderId: "", groupId: "" });

export function OrgEditor({
  draft,
  idx,
  members,
  groups,
  busy,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  draft: OrgDraft;
  idx: OrgIndex;
  members: OrgMember[];
  groups: OrgGroupOption[];
  busy: boolean;
  error: string | null;
  onSave: (d: OrgDraft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState(draft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Un poste ne peut pas aller sous lui-même ni sous ses sous-postes.
  const parents = useMemo(() => {
    const banned = d.id ? descendantsOf(idx, d.id) : new Set<string>();
    if (d.id) banned.add(d.id);
    return flattenOrg(idx).filter(({ node }) => !banned.has(node.id));
  }, [idx, d.id]);

  // Le titulaire actuel reste proposé même s'il n'est plus dans la liste.
  const holderOptions = useMemo(() => {
    const cur = d.id ? idx.byId.get(d.id)?.holder : null;
    const list = [...members];
    if (cur && !list.some((m) => m.id === cur.id)) list.push({ id: cur.id, nickname: cur.nickname });
    return list.sort((a, b) => a.nickname.localeCompare(b.nickname, "fr", { sensitivity: "base" }));
  }, [members, idx, d.id]);

  const kids = d.id ? kidsOf(idx, d.id).length : 0;
  const parentLabel = (id: string) => (id ? idx.byId.get(id)?.label ?? "?" : "");
  const original = d.id ? idx.byId.get(d.id) : null;
  const set = (patch: Partial<OrgDraft>) => setD((x) => ({ ...x, ...patch }));

  return (
    <div className="org-modal" role="dialog" aria-modal="true" aria-labelledby="org-editor-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="org-modal-panel glass-card"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...d, label: d.label.trim(), description: d.description.trim() });
        }}
      >
        <h2 id="org-editor-title" className="font-display text-lg uppercase tracking-wide text-paper">
          {d.id ? "Modifier le poste" : d.parentId ? `Nouveau poste sous « ${parentLabel(d.parentId)} »` : "Nouveau poste"}
        </h2>

        <label className="block space-y-1">
          <span className={labelClass}>Titre du poste</span>
          <input ref={first} required maxLength={60} className={inputClass} value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="Chef du Renseignement" />
        </label>

        <label className="block space-y-1">
          <span className={labelClass}>
            Mission <span className="normal-case text-paper/50">(facultatif · {240 - d.description.length})</span>
          </span>
          <textarea maxLength={240} rows={2} className={`${inputClass} resize-y`} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce que fait ce poste, en une phrase." />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={labelClass}>Titulaire</span>
            <select className={inputClass} value={d.holderId} onChange={(e) => set({ holderId: e.target.value })}>
              <option value="">Poste vacant</option>
              {holderOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={labelClass}>Équipe ou système</span>
            <select className={inputClass} value={d.groupId} onChange={(e) => set({ groupId: e.target.value })}>
              <option value="">Aucune</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.is_independent_system ? " (système indépendant)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className={labelClass}>Sous les ordres de</span>
          <select className={inputClass} value={d.parentId} onChange={(e) => set({ parentId: e.target.value })}>
            <option value="">Personne : sommet de l&apos;organigramme</option>
            {parents.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {"  ".repeat(depth)}
                {depth ? "└ " : ""}
                {node.label}
                {node.holder ? ` (${node.holder.nickname})` : ""}
              </option>
            ))}
          </select>
          {original && original.parent_id !== (d.parentId || null) && kids > 0 && (
            <span className="block font-mono text-[11px] text-paper/60">Ses {kids} sous-poste(s) le suivent.</span>
          )}
        </label>

        {error && <p className="font-mono text-xs text-red">{error}</p>}

        {confirmDelete && d.id ? (
          <div className="space-y-3 rounded-lg border border-red/40 bg-red/10 p-3">
            <p className="font-body text-sm text-paper">
              Supprimer « {original?.label} » ?{" "}
              {kids > 0
                ? `Ses ${kids} sous-poste(s) remontent ${original?.parent_id ? `sous « ${parentLabel(original.parent_id)} »` : "au sommet"}.`
                : "Il n'a aucun sous-poste."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => onDelete(d.id!)} className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light disabled:opacity-50">
                Supprimer le poste
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-white/20 px-4 py-2 font-display text-sm uppercase text-paper hover:bg-white/10">
                Garder
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" disabled={busy || !d.label.trim()} className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light disabled:opacity-50">
              {busy ? "Enregistrement…" : d.id ? "Enregistrer" : "Créer le poste"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/20 px-4 py-2 font-display text-sm uppercase text-paper hover:bg-white/10">
              Annuler
            </button>
            {d.id && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto font-mono text-xs uppercase text-red hover:underline">
                Supprimer
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
