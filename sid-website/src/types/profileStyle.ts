export type ProfileCssSection = "org_chart" | "roster" | "leaderboard" | "profile";

export const PROFILE_CSS_SECTIONS: { key: ProfileCssSection; label: string; hint: string }[] = [
  { key: "org_chart", label: "Organigramme", hint: "Ta carte dans l'organigramme (RankCard non inclus, uniquement le nœud)." },
  { key: "roster", label: "Trombinoscope", hint: "Ta carte dans la liste des membres." },
  { key: "leaderboard", label: "Classement", hint: "Ta ligne dans le classement (puissance, argent, renommée…)." },
  { key: "profile", label: "Profil", hint: "Ta fiche de profil, telle que les autres la voient." },
];

export interface ProfileStyleRow {
  user_id: string;
  section: ProfileCssSection;
  css: string;
  updated_at: string;
}
