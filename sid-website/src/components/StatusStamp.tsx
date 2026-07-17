import clsx from "clsx";
import type { QuestStatus } from "@/types/database";

const LABELS: Record<QuestStatus, string> = {
  open: "Ouverte",
  in_progress: "En cours",
  completed: "Accomplie",
  failed: "Échouée",
  cancelled: "Annulée",
};

const COLORS: Record<QuestStatus, string> = {
  open: "text-olive",
  in_progress: "text-brass",
  completed: "text-teal",
  failed: "text-redact",
  cancelled: "text-redact",
};

export function StatusStamp({ status }: { status: QuestStatus }) {
  return <span className={clsx("stamp", COLORS[status])}>{LABELS[status]}</span>;
}
