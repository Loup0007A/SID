// Alertes d'activité inhabituelle (migration 0060) : libellés et affichage.

export type AlertRow = {
  id: number;
  user_id: string | null;
  nickname: string | null;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  details: Record<string, unknown>;
  status: "open" | "resolved" | "ignored";
  created_at: string;
  handled_by_nickname: string | null;
  handled_at: string | null;
};

export const ALERT_KINDS: Record<string, string> = {
  gros_montant: "Gros mouvement d'argent",
  enrichissement: "Enrichissement rapide",
  spam: "Rafale de messages",
  simulations: "Simulations en série",
  simulations_rapides: "Simulations trop rapides",
  achats: "Achats en rafale",
  admin_rafale: "Actions d'admin en série",
  auto_attribution: "Admin sur son propre compte",
  sanctions: "Sanctions répétées",
  nouveau_compte: "Nouveau compte très actif",
  compte_reveille: "Compte réveillé",
  demande_suppression: "Demande de suppression",
};

export const SEVERITY: Record<AlertRow["severity"], { label: string; className: string }> = {
  critical: { label: "Critique", className: "border-red bg-red/20 text-red" },
  warning: { label: "À vérifier", className: "border-yellow-400/70 bg-yellow-400/10 text-yellow-300" },
  info: { label: "Info", className: "border-blue/60 bg-blue/10 text-blue-light" },
};

const DETAIL_LABELS: Record<string, string> = {
  montant: "montant",
  motif: "motif",
  total: "total",
  mouvements: "mouvements",
  messages: "messages",
  salons: "salons",
  reussites: "réussites",
  parties: "parties",
  plus_rapide_s: "plus rapide (s)",
  achats: "achats",
  actions: "actions",
  types: "types",
  action: "action",
  sanctions: "sanctions",
  solde: "solde",
  messages_24h: "messages (24 h)",
  derniere_visite: "visite précédente",
  gravite: "gravité",
  statut: "statut",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(n)) return n.toLocaleString("fr-FR");
  return String(v);
}

/** « montant : 15 000 · motif : Héritage » */
export function describeAlert(details: Record<string, unknown> | null): string {
  if (!details) return "";
  return Object.entries(details)
    .filter(([k, v]) => v !== null && v !== undefined && k !== "details")
    .map(([k, v]) => `${DETAIL_LABELS[k] ?? k} : ${fmt(v)}`)
    .join(" · ");
}

export const ALERT_SETTINGS: { key: string; label: string; unit: string }[] = [
  { key: "alert_big_tx", label: "Mouvement d'argent à signaler", unit: "z" },
  { key: "alert_daily_gain", label: "Gains en 24 h à signaler", unit: "z" },
  { key: "alert_msgs_hour", label: "Messages en une heure", unit: "messages" },
  { key: "alert_sim_hour", label: "Simulations réussies en une heure", unit: "parties" },
  { key: "alert_sim_min_s", label: "Victoire en simulation plus rapide que", unit: "secondes" },
  { key: "alert_purchases_hour", label: "Achats en une heure", unit: "achats" },
  { key: "alert_admin_burst", label: "Actions d'admin en 10 minutes", unit: "actions" },
  { key: "alert_dormant_days", label: "Retour après une absence de", unit: "jours" },
];

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}
