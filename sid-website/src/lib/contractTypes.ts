import type { ContractType } from "@/types/database";

export const CONTRACT_TYPES: { value: ContractType; label: string; color: string }[] = [
  { value: "politique", label: "Politique", color: "#2B2B2B" },
  { value: "tuer", label: "Tuer", color: "#B23B2E" },
  { value: "chasse", label: "Chasse", color: "#38316B" },
  { value: "raid", label: "Raid", color: "#E8C547" },
  { value: "autres", label: "Autres", color: "#7EC8E3" },
  { value: "missions_exterieures", label: "Missions extérieures", color: "#2E5FA3" },
  { value: "espionnage", label: "Espionnage", color: "#3F8F5F" },
  { value: "politique_x", label: "Politique X", color: "#D6579A" },
  { value: "collecte_vol", label: "Collecte / Vol", color: "#5B4130" },
];

const MAP = new Map(CONTRACT_TYPES.map((t) => [t.value, t]));

export function contractTypeInfo(type: ContractType) {
  return MAP.get(type) ?? CONTRACT_TYPES[4]; // repli sur "Autres"
}
