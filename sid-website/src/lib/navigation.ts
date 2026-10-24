import type { PermissionKey } from "@/types/database";
import { SIMULATION_SITES, type SimulationKind } from "@/lib/simulationSites";
import type { MaintenanceSection } from "@/lib/maintenance";
import type { IconName } from "@/components/icons/sidIcons";

/**
 * Toutes les pages du tableau de bord, à un seul endroit : la page
 * d'accueil (grille d'icônes) et la barre du haut (titre de la page en
 * cours) se servent de cette liste. Pour ajouter une page : une ligne ici.
 *
 * ICÔNES : chaque entrée a son icône S.I.D. (champ `icon`), dessinée dans
 * src/components/icons/sidIcons.tsx. Pour en changer : choisir un autre nom
 * de cette liste, ou y dessiner une nouvelle icône.
 */

export type NavGroup = "espace" | "jeu" | "entrainement" | "economie" | "admin";

export interface NavEntry {
  /** Identifiant stable, utilisé aussi comme nom de fichier de l'icône. */
  key: string;
  href: string;
  label: string;
  description: string;
  /** Émoji gardé pour les textes simples (listes déroulantes, titres d'onglet). */
  emoji: string;
  /** Icône S.I.D. (src/components/icons/sidIcons.tsx). */
  icon: IconName;
  group: NavGroup;
  /** Visible seulement si le membre a AU MOINS UNE de ces permissions. */
  perm?: PermissionKey[];
  /** Affiche le bandeau de chantier « En développement » sur la tuile. */
  wip?: boolean;
  /** Section que l'administration peut suspendre (bandeau « Service suspendu »). */
  section?: MaintenanceSection;
}

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "espace", label: "Mon espace" },
  { key: "jeu", label: "Le S.I.D." },
  { key: "entrainement", label: "Entraînement" },
  { key: "economie", label: "Économie" },
  { key: "admin", label: "Administration" },
];

export const NAV_ENTRIES: NavEntry[] = [
  { key: "profile", href: "/dashboard/profile", label: "Mon dossier", description: "Ton profil, ta photo, ta confidentialité", emoji: "🪪", icon: "profile", group: "espace" },
  { key: "chat", href: "/dashboard/chat", label: "Messagerie", description: "Messages privés et groupes", emoji: "💬", icon: "chat", group: "espace", section: "chat" },
  { key: "notifications", href: "/dashboard/notifications", label: "Notifications", description: "Tout ce qui t'est arrivé récemment", emoji: "🔔", icon: "bell", group: "espace" },
  { key: "titles", href: "/dashboard/titles", label: "Titres", description: "Titres secrets et pouvoirs de farce", emoji: "🏅", icon: "medal", group: "espace" },
  { key: "settings", href: "/dashboard/settings", label: "Réglages", description: "Apparence de tes cartes", emoji: "⚙️", icon: "gear", group: "espace" },
  { key: "privacy", href: "/dashboard/privacy", label: "Mes données", description: "Ce que le S.I.D. garde sur toi", emoji: "🔐", icon: "padlock", group: "espace" },

  { key: "quests", href: "/dashboard/quests", label: "Quêtes", description: "Missions ouvertes et en cours", emoji: "📜", icon: "scroll", group: "jeu", section: "quests" },
  { key: "tech", href: "/dashboard/tech", label: "Arbre technologique", description: "Dépense tes points de simulation", emoji: "🌳", icon: "tree", group: "entrainement" },
  { key: "map", href: "/dashboard/map", label: "Carte", description: "Ta position et tes trajets", emoji: "🗺️", icon: "map", group: "jeu" },
  { key: "leaderboard", href: "/dashboard/leaderboard", label: "Classement", description: "Puissance, argent, renommée", emoji: "🏆", icon: "trophy", group: "jeu" },
  { key: "org-chart", href: "/dashboard/org-chart", label: "Organigramme", description: "La hiérarchie du S.I.D.", emoji: "🏛️", icon: "orgchart", group: "jeu" },
  { key: "members", href: "/dashboard/members", label: "Trombinoscope", description: "Tous les membres", emoji: "👥", icon: "people", group: "jeu" },

  ...(["donjons", "intelligence", "techniques"] as SimulationKind[]).map((kind): NavEntry => {
    const site = SIMULATION_SITES[kind];
    return {
      key: kind,
      href: `/dashboard/simulations/${kind}`,
      label: site.label,
      description: site.description,
      emoji: site.emoji,
      icon: site.icon,
      group: "entrainement",
      wip: site.inDevelopment,
      section: "simulations",
    };
  }),

  { key: "shop", href: "/dashboard/shop", label: "Boutique", description: "Acheter et vendre des objets", emoji: "🛒", icon: "cart", group: "economie", section: "shop" },
  { key: "bank", href: "/dashboard/bank", label: "Banque", description: "Épargne, emprunts et bourse", emoji: "🏦", icon: "bank", group: "economie", section: "bank" },
  { key: "business", href: "/dashboard/business", label: "Entreprise", description: "Gérer tes entreprises", emoji: "🏢", icon: "office", group: "economie", perm: ["entreprise"] },

  { key: "applications", href: "/dashboard/admin/applications", label: "Recrutement", description: "Candidatures en attente", emoji: "📋", icon: "clipboard", group: "admin", perm: ["recruit"] },
  { key: "roles", href: "/dashboard/admin/roles", label: "Rôles & équipes", description: "Rôles, permissions, rangs", emoji: "🎖️", icon: "rank", group: "admin", perm: ["manage_roles", "manage_teams", "manage_users"] },
  { key: "economy", href: "/dashboard/admin/economy", label: "Économie", description: "Soldes, salaires, impôts", emoji: "💰", icon: "coins", group: "admin", perm: ["manage_economy"] },
  { key: "simulation", href: "/dashboard/admin/simulation", label: "Simulation", description: "La population simulée", emoji: "🧬", icon: "dna", group: "admin", perm: ["manage_economy"] },
  { key: "stats", href: "/dashboard/admin/stats", label: "Statistiques", description: "Activité du site", emoji: "📊", icon: "chart", group: "admin", perm: ["manage_users"] },
  { key: "users", href: "/dashboard/admin/users", label: "Comptes", description: "Fiches des membres, bannir, muter", emoji: "🛡️", icon: "shieldUser", group: "admin", perm: ["manage_users"] },
  { key: "alerts", href: "/dashboard/admin/alerts", label: "Alertes", description: "Activité inhabituelle à vérifier", emoji: "🚨", icon: "siren", group: "admin", perm: ["manage_users"] },
  { key: "moderation", href: "/dashboard/admin/moderation", label: "Modération", description: "Annonces, maintenance, sanctions", emoji: "⚖️", icon: "scales", group: "admin", perm: ["manage_users"] },
  { key: "trolls", href: "/dashboard/admin/titles", label: "Titres & farces", description: "Porteurs, farces en cours, boucliers", emoji: "🎭", icon: "masks", group: "admin", perm: ["manage_users"] },
  { key: "sandbox", href: "/dashboard/admin/sandbox", label: "Bac à sable", description: "Tester le site avec un compte temporaire", emoji: "🧪", icon: "bucket", group: "admin", perm: ["manage_users"] },
  { key: "audit", href: "/dashboard/admin/audit", label: "Journal d'audit", description: "Qui a fait quoi, et quand", emoji: "🕵️", icon: "magnifier", group: "admin", perm: ["manage_users"] },
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
