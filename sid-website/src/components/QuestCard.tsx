import type { Quest } from "@/types/database";
import { DifficultyBadge } from "./DifficultyBadge";
import { StatusStamp } from "./StatusStamp";
import { contractTypeInfo } from "@/lib/contractTypes";

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Légère rotation alternée, dérivée de l'id de la quête (stable, pas aléatoire
// à chaque rendu) pour un effet "notes punaisées sur un panneau" discret.
function tiltFor(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const angles = [-1.2, -0.4, 0.6, 1.3];
  return angles[hash % angles.length];
}

// Texte clair ou foncé selon la luminosité de la couleur de fond, pour que
// le libellé du type de contrat reste lisible quelle que soit la teinte.
function readableTextColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#2B2F28" : "#F4EFE0";
}

export function QuestCard({ quest, participantCount }: { quest: Quest; participantCount?: number }) {
  const deadline = formatDeadline(quest.deadline);
  const isUrgent =
    quest.deadline && new Date(quest.deadline).getTime() - Date.now() < 3 * 24 * 3600 * 1000;
  const isFull = quest.max_participants != null && (participantCount ?? 0) >= quest.max_participants;
  const type = contractTypeInfo(quest.contract_type);

  return (
    <div
      className="quest-card relative flex flex-col gap-2 p-4 pt-0 transition hover:-translate-y-1 hover:rotate-0"
      style={{ transform: `rotate(${tiltFor(quest.id)}deg)` }}
    >
      <div
        className="-mx-4 mb-3 flex items-center justify-center px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ backgroundColor: type.color, color: readableTextColor(type.color), borderRadius: "0.5rem 1rem 0 0" }}
      >
        {type.label}
      </div>

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg uppercase tracking-wide">{quest.title}</h3>
        <DifficultyBadge difficulty={quest.difficulty} />
      </div>

      {quest.description && (
        <p className="line-clamp-3 font-body text-sm text-paper-text/80">{quest.description}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-paper-dark/70 pt-2 font-mono text-xs">
        <span className="font-semibold text-blue-dark">{quest.reward.toLocaleString("fr-FR")} Cr.</span>
        <StatusStamp status={quest.status} />
      </div>

      {quest.max_participants != null && participantCount !== undefined && (
        <div className={isFull ? "font-mono text-xs font-bold text-red-dark" : "font-mono text-xs text-paper-text/70"}>
          Places : {participantCount} / {quest.max_participants}
        </div>
      )}

      {deadline && (
        <div className={isUrgent ? "font-mono text-xs font-bold text-red-dark" : "font-mono text-xs text-paper-text/70"}>
          Échéance : {deadline}
        </div>
      )}
    </div>
  );
}
