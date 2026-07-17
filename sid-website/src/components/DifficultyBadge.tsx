import clsx from "clsx";
import type { QuestDifficulty } from "@/types/database";

const COLORS: Record<QuestDifficulty, string> = {
  E: "bg-olive-light text-ink border-olive",
  D: "bg-teal text-paper border-teal",
  C: "bg-brass text-ink border-brass",
  B: "bg-redact text-paper border-redact",
  A: "bg-[#5A2E24] text-paper border-[#5A2E24]",
  S: "bg-ink text-brass border-brass",
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
