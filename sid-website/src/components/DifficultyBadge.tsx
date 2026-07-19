import clsx from "clsx";
import type { QuestDifficulty } from "@/types/database";

const COLORS: Record<QuestDifficulty, string> = {
  E: "bg-blue-light text-ink border-blue-light",
  D: "bg-blue text-paper border-blue",
  C: "bg-blue-dark text-paper border-blue-dark",
  B: "bg-red-dark text-paper border-red-dark",
  A: "bg-red text-paper border-red",
  S: "bg-ink text-red border-red",
};

export function DifficultyBadge({ difficulty }: { difficulty: QuestDifficulty }) {
  return (
    <span
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold",
        COLORS[difficulty]
      )}
      title={`Rang ${difficulty}`}
    >
      {difficulty}
    </span>
  );
}
