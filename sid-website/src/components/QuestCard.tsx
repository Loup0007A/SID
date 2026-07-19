import type { Quest } from "@/types/database";
import { DifficultyBadge } from "./DifficultyBadge";
import { StatusStamp } from "./StatusStamp";

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function QuestCard({ quest }: { quest: Quest }) {
  const deadline = formatDeadline(quest.deadline);
  const isUrgent =
    quest.deadline && new Date(quest.deadline).getTime() - Date.now() < 3 * 24 * 3600 * 1000;

  return (
    <div className="dossier-card relative flex flex-col gap-2 p-4 transition hover:-translate-y-1 hover:rotate-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg uppercase tracking-wide">{quest.title}</h3>
        <DifficultyBadge difficulty={quest.difficulty} />
      </div>

      {quest.description && (
        <p className="line-clamp-3 font-body text-sm text-paper-text/80">{quest.description}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-paper-dark pt-2 font-mono text-xs">
        <span className="font-semibold text-blue">{quest.reward.toLocaleString("fr-FR")} Cr.</span>
        <StatusStamp status={quest.status} />
      </div>

      {deadline && (
        <div className={isUrgent ? "font-mono text-xs font-bold text-red" : "font-mono text-xs text-paper-text/70"}>
          Échéance : {deadline}
        </div>
      )}
    </div>
  );
}
