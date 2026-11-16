/**
 * Organigramme (Lot 83) : données renvoyées par org_chart() et calculs sur
 * l'arbre. Écriture : org_node_save / org_node_move / org_node_delete.
 */

export type OrgHolder = { id: string; nickname: string; avatar_url: string | null };
export type OrgTeam = { id: string; name: string; independent: boolean };

export type OrgChartNode = {
  id: string;
  parent_id: string | null;
  label: string;
  description: string | null;
  sort_order: number;
  holder: OrgHolder | null;
  group: OrgTeam | null;
};

export type OrgChartData = { can_manage: boolean; nodes: OrgChartNode[] };

export type OrgIndex = {
  byId: Map<string, OrgChartNode>;
  /** Sous-postes par supérieur (clé "" : sommet), triés. */
  children: Map<string, OrgChartNode[]>;
  roots: OrgChartNode[];
};

const ROOT = "";

export function indexOrg(nodes: OrgChartNode[]): OrgIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, OrgChartNode[]>();
  for (const n of nodes) {
    // Supérieur disparu : le poste remonte au sommet plutôt que de se perdre.
    const key = n.parent_id && byId.has(n.parent_id) ? n.parent_id : ROOT;
    const list = children.get(key) ?? [];
    list.push(n);
    children.set(key, list);
  }
  children.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "fr")));
  return { byId, children, roots: children.get(ROOT) ?? [] };
}

export const kidsOf = (idx: OrgIndex, id: string) => idx.children.get(id) ?? [];

/** Tous les sous-postes (à toute profondeur) d'un poste. */
export function descendantsOf(idx: OrgIndex, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [...kidsOf(idx, id)];
  while (stack.length) {
    const n = stack.pop()!;
    if (out.has(n.id)) continue;
    out.add(n.id);
    stack.push(...kidsOf(idx, n.id));
  }
  return out;
}

/** Liste à plat, dans l'ordre de l'arbre, avec la profondeur (pour les listes de choix). */
export function flattenOrg(idx: OrgIndex): { node: OrgChartNode; depth: number }[] {
  const out: { node: OrgChartNode; depth: number }[] = [];
  const walk = (list: OrgChartNode[], depth: number) => {
    for (const n of list) {
      out.push({ node: n, depth });
      walk(kidsOf(idx, n.id), depth + 1);
    }
  };
  walk(idx.roots, 0);
  return out;
}

/** Chemin du sommet jusqu'au poste (exclu). */
export function ancestorsOf(idx: OrgIndex, id: string): OrgChartNode[] {
  const out: OrgChartNode[] = [];
  let cur = idx.byId.get(id)?.parent_id ?? null;
  while (cur && idx.byId.has(cur) && out.length < 200) {
    const n = idx.byId.get(cur)!;
    out.unshift(n);
    cur = n.parent_id;
  }
  return out;
}
