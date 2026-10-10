import type { PermissionKey } from "@/types/database";

/**
 * Toutes les pages du tableau de bord, à un seul endroit : la page
 * d'accueil (grille d'icônes) et la barre du haut (titre de la page en
 * cours) se servent de cette liste. Pour ajouter une page : une ligne ici.
 *
 * ICÔNES : chaque entrée affiche l'image `public/icons/<key>.png` si elle
 * existe, sinon l'emoji de secours. Il suffit donc de déposer un fichier
 * PNG portant exactement le nom de la clé (ex. `public/icons/quests.png`)
 * pour remplacer l'emoji — aucune ligne de code à toucher. Format conseillé :
 * carré, fond transparent, 128×128 px ou plus. La liste complète des noms
 * attendus est dans `public/icons/LISEZMOI.md`.
 */

export type NavGroup = "espace" | "jeu" | "economie" | "admin";

export interface NavEntry {
  /** Identifiant stable, utilisé aussi comme nom de fichier de l'icône. */
  key: string;
  href: string;
  label: string;
  description: string;
  /** Affiché tant que `public/icons/<key>.png` n'existe pas. */
  emoji: string;
  group: NavGroup;
  /** Visible seulement si le membre a AU MOINS UNE de ces permissions. */
  perm?: PermissionKey[];
}

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "espace", label: "Mon espace" },
  { key: "jeu", label: "Le S.I.D." },
  { key: "economie", label: "Économie" },
  { key: "admin", label: "Administration" },
];

export const NAV_ENTRIES: NavEntry[] = [
  { key: "profile", href: "/dashboard/profile", label: "Mon dossier", description: "Ton profil, ta photo, ta confidentialité", emoji: "🪪", group: "espace" },
  { key: "chat", href: "/dashboard/chat", label: "Messagerie", description: "Messages privés et groupes", emoji: "💬", group: "espace" },
  { key: "notifications", href: "/dashboard/notifications", label: "Notifications", description: "Tout ce qui t'est arrivé récemment", emoji: "🔔", group: "espace" },
  { key: "settings", href: "/dashboard/settings", label: "Réglages", description: "Apparence de tes cartes", emoji: "⚙️", group: "espace" },

  { key: "quests", href: "/dashboard/quests", label: "Quêtes", description: "Missions ouvertes et en cours", emoji: "📜", group: "jeu" },
  { key: "map", href: "/dashboard/map", label: "Carte", description: "Ta position et tes trajets", emoji: "🗺️", group: "jeu" },
  { key: "leaderboard", href: "/dashboard/leaderboard", label: "Classement", description: "Puissance, argent, renommée", emoji: "🏆", group: "jeu" },
  { key: "org-chart", href: "/dashboard/org-chart", label: "Organigramme", description: "La hiérarchie du S.I.D.", emoji: "🏛️", group: "jeu" },
  { key: "members", href: "/dashboard/members", label: "Trombinoscope", description: "Tous les membres", emoji: "👥", group: "jeu" },

  { key: "shop", href: "/dashboard/shop", label: "Boutique", description: "Acheter et vendre des objets", emoji: "🛒", group: "economie" },
  { key: "bank", href: "/dashboard/bank", label: "Banque", description: "Épargne, emprunts et bourse", emoji: "🏦", group: "economie" },
  { key: "business", href: "/dashboard/business", label: "Entreprise", description: "Gérer tes entreprises", emoji: "🏢", group: "economie", perm: ["entreprise"] },

  { key: "applications", href: "/dashboard/admin/applications", label: "Recrutement", description: "Candidatures en attente", emoji: "📋", group: "admin", perm: ["recruit"] },
  { key: "roles", href: "/dashboard/admin/roles", label: "Rôles & équipes", description: "Rôles, permissions, rangs", emoji: "🎖️", group: "admin", perm: ["manage_roles", "manage_teams", "manage_users"] },
  { key: "economy", href: "/dashboard/admin/economy", label: "Économie", description: "Soldes, salaires, impôts", emoji: "💰", group: "admin", perm: ["manage_economy"] },
  { key: "simulation", href: "/dashboard/admin/simulation", label: "Simulation", description: "La population simulée", emoji: "🧬", group: "admin", perm: ["manage_economy"] },
  { key: "stats", href: "/dashboard/admin/stats", label: "Statistiques", description: "Activité du site", emoji: "📊", group: "admin", perm: ["manage_users"] },
  { key: "users", href: "/dashboard/admin/users", label: "Comptes", description: "Bannir, muter, mots de passe", emoji: "🛡️", group: "admin", perm: ["manage_users"] },
  { key: "moderation", href: "/dashboard/admin/moderation", label: "Modération", description: "Annonces, maintenance, sanctions", emoji: "⚖️", group: "admin", perm: ["manage_users"] },
  { key: "audit", href: "/dashboard/admin/audit", label: "Journal d'audit", description: "Qui a fait quoi, et quand", emoji: "🕵️", group: "admin", perm: ["manage_users"] },
];

/** Les entrées visibles pour un membre selon ses permissions. */
export function visibleEntries(can: (...anyOf: PermissionKey[]) => boolean): NavEntry[] {
  return NAV_ENTRIES.filter((e) => !e.perm || can(...e.perm));
}

/** L'entrée correspondant à une URL (la plus précise), ex. /dashboard/admin/users/xyz -> "Comptes". */
export function entryForPath(pathname: string): NavEntry | undefined {
  return [...NAV_ENTRIES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((e) => pathname === e.href || pathname.startsWith(`${e.href}/`));
}
