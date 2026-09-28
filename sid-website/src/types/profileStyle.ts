export type ProfileCssSection = "org_chart" | "roster" | "leaderboard" | "profile";

export const PROFILE_CSS_SECTIONS: { key: ProfileCssSection; label: string; hint: string }[] = [
  { key: "org_chart", label: "Organigramme", hint: "Ta carte (poste) dans l'organigramme." },
  { key: "roster", label: "Trombinoscope", hint: "Ta carte dans la liste des membres." },
  { key: "leaderboard", label: "Classement", hint: "Ta ligne dans le classement (puissance, argent, renommée…)." },
  { key: "profile", label: "Profil", hint: "L'en-tête de ta fiche de profil (carte de rang + pseudo), telle que les autres la voient." },
];

export interface ProfileStyleRow {
  user_id: string;
  section: ProfileCssSection;
  css: string;
  updated_at: string;
}

/**
 * Un exemple de départ par section, affiché dans le champ tant que rien
 * n'a été enregistré — l'utilisateur peut le modifier, l'étoffer ou le
 * vider entièrement. Les propriétés du haut (sans sélecteur) s'appliquent
 * directement à la carte elle-même.
 */
export const DEFAULT_PROFILE_CSS: Record<ProfileCssSection, string> = {
  org_chart: `/* Sans sélecteur = s'applique à ta carte elle-même */
border: 1px solid rgba(143, 179, 217, 0.4);
box-shadow: 0 0 12px rgba(143, 179, 217, 0.15);`,
  roster: `/* Sans sélecteur = s'applique à ta carte elle-même */
border: 1px solid rgba(217, 154, 154, 0.4);`,
  leaderboard: `/* Sans sélecteur = s'applique à ta ligne elle-même */
background: rgba(143, 179, 217, 0.06);`,
  profile: `/* Sans sélecteur = s'applique à la carte elle-même */
border: 1px solid rgba(212, 175, 55, 0.35);
box-shadow: 0 0 16px rgba(212, 175, 55, 0.12);

/* Pour cibler un élément précis à l'intérieur, ajoute un sélecteur : */
.rank-card-letter {
  text-shadow: 0 0 8px currentColor;
}`,
};

/** Classes utiles à connaître par section (celles vraiment présentes dans le rendu). Les noms sont sensibles à la casse (écris-les en minuscules). */
export const AVAILABLE_CLASSES: Record<ProfileCssSection, { className: string; hint: string }[]> = {
  org_chart: [
    { className: "font-display", hint: "titre du poste" },
  ],
  roster: [
    { className: "font-display", hint: "ton pseudo (grand titre)" },
    { className: "font-mono", hint: "textes en monospace (rôle, âge…)" },
    { className: "font-body", hint: "description" },
  ],
  leaderboard: [
    { className: "font-display", hint: "ton pseudo dans la ligne" },
    { className: "font-mono", hint: "le score affiché à droite" },
  ],
  profile: [
    { className: "rank-card", hint: "la carte de rang (lettre E à S) dans son ensemble" },
    { className: "rank-card-letter", hint: "la grande lettre de rang" },
    { className: "rank-card-title", hint: "le petit texte sous la lettre (ex : VÉTÉRAN)" },
    { className: "font-display", hint: "ton pseudo" },
  ],
};
