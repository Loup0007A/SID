import Link from "next/link";
import type { OrgNode, Profile, Group } from "@/types/database";

interface Props {
  nodes: OrgNode[];
  profiles: Map<string, Profile>;
  groups: Map<string, Group>;
  parentId: string | null;
  onDelete?: (id: string) => void;
  canManage?: boolean;
  isRoot?: boolean;
}

export function OrgTree({ nodes, profiles, groups, parentId, onDelete, canManage, isRoot = true }: Props) {
  const children = nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (children.length === 0) return null;

  return (
    <ul className={isRoot ? "org-tree" : undefined}>
      {children.map((node) => {
        const holder = node.holder_id ? profiles.get(node.holder_id) : null;
        const group = node.group_id ? groups.get(node.group_id) : null;
        return (
          <li key={node.id}>
            <div className="glass-card inline-flex flex-col gap-1 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="font-display uppercase tracking-wide">{node.label}</span>
                {group?.is_independent_system && (
                  <span className="stamp text-blue">Système indépendant</span>
                )}
                {canManage && onDelete && (
                  <button
                    onClick={() => onDelete(node.id)}
                    className="ml-2 font-mono text-xs text-red hover:underline"
                  >
                    supprimer
                  </button>
                )}
              </div>
              <span className="font-mono text-xs text-paper/70">
                {holder ? (
                  <Link href={`/dashboard/profile/${holder.id}`} className="hover:text-blue-light hover:underline">
                    {holder.nickname}
                  </Link>
                ) : (
                  "Poste vacant"
                )}
                {group ? ` · ${group.name}` : ""}
              </span>
            </div>
            <OrgTree
              nodes={nodes}
              profiles={profiles}
              groups={groups}
              parentId={node.id}
              onDelete={onDelete}
              canManage={canManage}
              isRoot={false}
            />
          </li>
        );
      })}
    </ul>
  );
}
