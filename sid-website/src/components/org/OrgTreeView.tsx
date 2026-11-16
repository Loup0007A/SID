"use client";

import { useEffect, useRef } from "react";
import { SidIcon } from "@/components/icons/SidIcon";
import { OrgCard } from "@/components/org/OrgCard";
import { descendantsOf, kidsOf, type OrgChartNode, type OrgIndex } from "@/lib/orgChart";

/**
 * Arbre de l'organigramme (Lot 83). Même balisage pour les deux vues :
 * « Arbre » (de haut en bas, traits de liaison) et « Liste » (en retrait),
 * la seule sur téléphone. Styles : .org-tree dans dashboard.css.
 */

type Actions = {
  onEdit: (n: OrgChartNode) => void;
  onAddChild: (n: OrgChartNode) => void;
  onMove: (n: OrgChartNode, dir: -1 | 1) => void;
};

type Props = {
  idx: OrgIndex;
  styles: Map<string, string>;
  myId: string | null;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  editing: boolean;
  busy: boolean;
  /** Poste à faire briller un instant (après création, « Ton poste »). */
  flash: string | null;
  actions: Actions;
};

function Branch({ list, top = false, ...p }: Props & { list: OrgChartNode[]; top?: boolean }) {
  // Sous-postes sans sous-postes eux-mêmes : empilés sous leur supérieur
  // plutôt qu'alignés, pour que l'arbre reste étroit.
  const stack = !top && list.length > 1 && list.every((n) => kidsOf(p.idx, n.id).length === 0 || p.collapsed.has(n.id));
  return (
    <ul className={stack ? "is-stack" : undefined}>
      {list.map((n, i) => {
        const kids = kidsOf(p.idx, n.id);
        const folded = kids.length > 0 && p.collapsed.has(n.id);
        const hidden = folded ? descendantsOf(p.idx, n.id).size : 0;
        return (
          <li key={n.id}>
            <OrgCard
              id={`org-${n.id}`}
              label={n.label}
              description={n.description}
              holder={n.holder}
              team={n.group}
              css={n.holder ? p.styles.get(n.holder.id) : null}
              isMe={!!p.myId && n.holder?.id === p.myId}
              className={p.flash === n.id ? "is-flash" : ""}
            >
              {(kids.length > 0 || p.editing) && (
                <div className="org-card-foot">
                  {kids.length > 0 && (
                    <button type="button" className="org-fold" aria-expanded={!folded} onClick={() => p.onToggle(n.id)}>
                      <span aria-hidden className={`org-chevron ${folded ? "" : "is-open"}`} />
                      {folded ? `${hidden} poste${hidden > 1 ? "s" : ""} replié${hidden > 1 ? "s" : ""}` : `${kids.length} sous-poste${kids.length > 1 ? "s" : ""}`}
                    </button>
                  )}
                  {p.editing && (
                    <span className="org-tools">
                      <button type="button" disabled={p.busy || i === 0} onClick={() => p.actions.onMove(n, -1)} aria-label={`Placer « ${n.label} » avant`} title="Avant">
                        <span aria-hidden className="org-arrow is-prev" />
                      </button>
                      <button type="button" disabled={p.busy || i === list.length - 1} onClick={() => p.actions.onMove(n, 1)} aria-label={`Placer « ${n.label} » après`} title="Après">
                        <span aria-hidden className="org-arrow is-next" />
                      </button>
                      <button type="button" disabled={p.busy} onClick={() => p.actions.onAddChild(n)} aria-label={`Ajouter un sous-poste à « ${n.label} »`} title="Ajouter un sous-poste">
                        <span aria-hidden className="org-plus">+</span>
                      </button>
                      <button type="button" disabled={p.busy} onClick={() => p.actions.onEdit(n)} aria-label={`Modifier « ${n.label} »`} title="Modifier">
                        <SidIcon name="pen" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </OrgCard>
            {kids.length > 0 && !folded && <Branch {...p} list={kids} />}
          </li>
        );
      })}
    </ul>
  );
}

export function OrgTreeView({ layout, ...p }: Props & { layout: "tree" | "list" }) {
  const scroller = useRef<HTMLDivElement>(null);
  const centered = useRef(false);

  // Arbre plus large que l'écran : on part centré sur le sommet.
  useEffect(() => {
    const el = scroller.current;
    if (!el || layout !== "tree" || centered.current || el.scrollWidth <= el.clientWidth) return;
    const first = el.querySelector<HTMLElement>(".org-card");
    if (!first) return;
    centered.current = true;
    const box = el.getBoundingClientRect();
    const card = first.getBoundingClientRect();
    el.scrollLeft += card.left + card.width / 2 - (box.left + box.width / 2);
  }, [layout, p.idx]);

  return (
    <div ref={scroller} className={`org-scroll ${layout === "list" ? "is-list" : ""}`}>
      <div className={`org-tree ${layout === "list" ? "is-list" : ""}`}>
        <Branch {...p} list={p.idx.roots} top />
      </div>
    </div>
  );
}
