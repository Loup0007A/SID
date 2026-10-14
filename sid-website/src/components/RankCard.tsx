import type { MemberRank } from "@/types/database";

const RANK_INFO: Record<MemberRank, { title: string; className: string; letter?: string }> = {
  E: { title: "Novice", className: "rank-card rank-e" },
  D: { title: "Éclaireur", className: "rank-card rank-d" },
  C: { title: "Agent confirmé", className: "rank-card rank-c" },
  B: { title: "Vétéran", className: "rank-card rank-b" },
  A: { title: "Élite", className: "rank-card rank-a" },
  S: { title: "Légende", className: "rank-card rank-s" },
  // Au-dessus de S : gagné en battant le niveau caché 101 de Donjons.
  Divin: { title: "Divin", className: "rank-card rank-divin", letter: "✦" },
};

export function RankCard({ rank }: { rank: MemberRank }) {
  const info = RANK_INFO[rank] ?? RANK_INFO.E;
  return (
    <div className={info.className}>
      <span className="rank-card-letter">{info.letter ?? rank}</span>
      <span className="rank-card-title">{info.title}</span>
    </div>
  );
}
