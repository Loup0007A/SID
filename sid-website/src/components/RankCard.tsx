import type { QuestDifficulty } from "@/types/database";

const RANK_INFO: Record<QuestDifficulty, { title: string; className: string }> = {
  E: { title: "Novice", className: "rank-card rank-e" },
  D: { title: "Éclaireur", className: "rank-card rank-d" },
  C: { title: "Agent confirmé", className: "rank-card rank-c" },
  B: { title: "Vétéran", className: "rank-card rank-b" },
  A: { title: "Élite", className: "rank-card rank-a" },
  S: { title: "Légende", className: "rank-card rank-s" },
};

export function RankCard({ rank }: { rank: QuestDifficulty }) {
  const info = RANK_INFO[rank];
  return (
    <div className={info.className}>
      <span className="rank-card-letter">{rank}</span>
      <span className="rank-card-title">{info.title}</span>
    </div>
  );
}
