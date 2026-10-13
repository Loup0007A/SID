import type { Quest } from "@/types/database";

/** Caractéristiques d'un membre comparées aux prérequis d'une quête. */
export type MemberCharacteristics = { intelligence: number; strength: number; technique: number; power: number };

export type QuestRequirement = { key: keyof MemberCharacteristics; label: string; short: string; min: number };

const FIELDS: { key: keyof MemberCharacteristics; column: keyof Quest; label: string; short: string }[] = [
  { key: "intelligence", column: "min_intelligence", label: "Intelligence", short: "Int." },
  { key: "strength", column: "min_strength", label: "Puissance", short: "Pui." },
  { key: "technique", column: "min_technique", label: "Technique", short: "Tech." },
  { key: "power", column: "min_power", label: "Puissance globale", short: "Glob." },
];

/** Prérequis renseignés (minimum > 0) d'une quête. */
export function questRequirements(quest: Quest): QuestRequirement[] {
  return FIELDS.map((f) => ({ key: f.key, label: f.label, short: f.short, min: Number(quest[f.column] ?? 0) })).filter(
    (r) => r.min > 0
  );
}

/** Prérequis que le membre n'atteint pas encore. */
export function unmetRequirements(quest: Quest, me: MemberCharacteristics | null): QuestRequirement[] {
  if (!me) return [];
  return questRequirements(quest).filter((r) => Number(me[r.key] ?? 0) < r.min);
}

export function formatStat(n: number): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
