// Libellés et descriptions des entrées du journal d'audit (page Journal
// d'audit, fiche d'un membre, alertes).

export const ACTION_LABELS: Record<string, string> = {
  profile_changed: "Profil modifié",
  role_assigned: "Rôle attribué",
  role_removed: "Rôle retiré",
  role_created: "Rôle créé",
  role_updated: "Rôle modifié",
  role_deleted: "Rôle supprimé",
  permission_granted: "Permission ajoutée",
  permission_revoked: "Permission retirée",
  sanction_issued: "Sanction",
  sanction_ended: "Fin de sanction",
  maintenance_changed: "Maintenance",
  wallet_adjusted: "Solde ajusté",
  reputation_adjusted: "Renommée ajustée",
  stats_changed: "Facteurs de puissance corrigés",
  levels_changed: "Niveaux modifiés",
  rank_divine: "Rang Divin obtenu (niveau 101)",
  account_invisible: "Compte rendu invisible",
  sandbox_created: "Compte de test créé (bac à sable)",
  sandbox_deleted: "Compte de test effacé (bac à sable)",
  account_visible: "Compte rendu visible",
  alert_settings_changed: "Seuils d'alerte modifiés",
  deletion_requested: "Suppression du compte demandée",
  deletion_cancelled: "Demande de suppression annulée",
  deletion_refused: "Demande de suppression refusée",
  account_deleted: "Compte supprimé (à sa demande)",
  password_reset: "Mot de passe réinitialisé",
  email_confirmed: "Email confirmé à la main",
};

export const FIELD_LABELS: Record<string, string> = {
  status: "statut",
  is_muted: "mute",
  is_frozen: "gel",
  is_founder: "fondateur",
  member_rank: "rang",
  power_score: "puissance",
  intelligence: "intelligence",
  strength: "puissance",
  technique: "technique",
  potions: "potions",
  enigmes: "énigmes",
  probleme: "problème",
  techniques: "techniques",
  "mondes-vivants": "donjons",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "en attente",
  active: "actif",
  rejected: "refusé",
  banned: "banni",
};

export const SANCTION_LABELS: Record<string, string> = {
  warning: "avertissement",
  mute: "mute",
  freeze: "gel du compte",
  ban: "bannissement",
  fine: "amende",
};

export const SECTION_LABELS: Record<string, string> = {
  shop: "Boutique",
  chat: "Messagerie",
  bank: "Banque & bourse",
  quests: "Quêtes",
  registrations: "Inscriptions",
  simulations: "Simulations",
};

export function show(value: unknown, field?: string): string {
  if (value === true) return "oui";
  if (value === false) return "non";
  if (value === null || value === undefined) return "—";
  if (field === "status" && typeof value === "string") return STATUS_LABELS[value] ?? value;
  return String(value);
}

export function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR")}`;
}

/** Une phrase lisible pour les détails de chaque type d'entrée. */
export function describe(row: { action: string; details: Record<string, unknown> | null }): string {
  const d = row.details ?? {};
  switch (row.action) {
    case "profile_changed":
    case "stats_changed":
    case "levels_changed":
      return Object.entries(d)
        .map(([k, v]) => {
          const change = v as { from?: unknown; to?: unknown };
          return `${FIELD_LABELS[k] ?? k} : ${show(change.from, k)} → ${show(change.to, k)}`;
        })
        .join(" · ");
    case "role_assigned":
    case "role_removed":
      return String(d.role ?? "");
    case "permission_granted":
    case "permission_revoked":
      return `${d.permission ?? ""} (rôle « ${d.role ?? "?"} »)`;
    case "role_created":
    case "role_deleted":
      return String(d.name ?? "");
    case "role_updated":
      return d.previous_name && d.previous_name !== d.name ? `« ${d.previous_name} » → « ${d.name} »` : String(d.name ?? "");
    case "sanction_issued": {
      const parts = [SANCTION_LABELS[String(d.type)] ?? String(d.type)];
      if (d.amount != null) parts.push(`${Number(d.amount).toLocaleString("fr-FR")} z`);
      if (d.reason) parts.push(`« ${d.reason} »`);
      if (d.expires_at) parts.push(`jusqu'au ${new Date(String(d.expires_at)).toLocaleString("fr-FR")}`);
      return parts.join(" · ");
    }
    case "sanction_ended":
      return SANCTION_LABELS[String(d.type)] ?? String(d.type);
    case "maintenance_changed":
      return `${SECTION_LABELS[String(d.section)] ?? String(d.section)} ${d.enabled ? "réactivée" : "suspendue"}`;
    case "sandbox_created": {
      const perms = Array.isArray(d.permissions) ? (d.permissions as string[]) : [];
      return `${perms.length ? perms.join(", ") : "simple membre"} · rang ${d.rang ?? "?"} · ${d.heures ?? "?"} h · ${Number(d.solde ?? 0).toLocaleString("fr-FR")} z`;
    }
    case "sandbox_deleted":
      return `${d.liens_nettoyes ?? 0} liens nettoyés${Array.isArray(d.echecs) && d.echecs.length ? ` · échecs : ${(d.echecs as string[]).join(", ")}` : ""}`;
    case "deletion_requested":
      return d.motif ? `« ${String(d.motif)} »` : "";
    case "deletion_refused":
      return d.note ? `« ${String(d.note)} »` : "";
    case "account_deleted":
      return `${d.liens_nettoyes ?? 0} liens nettoyés`;
    case "alert_settings_changed":
      return Object.entries(d).map(([k, v]) => `${k} = ${v}`).join(" · ");
    case "account_invisible":
    case "account_visible":
      return d.par_le_membre ? "par le membre lui-même" : "par l'administration";
    case "wallet_adjusted":
      return `${money(d.amount)} z${d.reason ? ` — « ${d.reason} »` : ""}`;
    case "reputation_adjusted":
      return `${money(d.amount)} de renommée${d.reason ? ` — « ${d.reason} »` : ""}`;
    default:
      return Object.keys(d).length ? JSON.stringify(d) : "";
  }
}
