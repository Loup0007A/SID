import type { CreerJeu } from "./moteur";
import { babyfoot } from "./babyfoot";
import { bowling } from "./bowling";
import { glouton } from "./glouton";
import { cassebriques } from "./cassebriques";
import { traineau } from "./traineau";
import { boules } from "./boules";
import { pile } from "./pile";

/** Les mini-jeux du calendrier (clés = avent_jeux.jeu, migration 0134). */
export const JEUX: Record<string, { creer: CreerJeu; commandes: string }> = {
  babyfoot: { creer: babyfoot, commandes: "Glisse le doigt ou la souris de gauche à droite, ou flèches ← →." },
  bowling: { creer: bowling, commandes: "Touche (ou espace) une fois pour le départ, une fois pour lancer." },
  glouton: { creer: glouton, commandes: "Glisse le doigt dans une direction, ou flèches." },
  cassebriques: { creer: cassebriques, commandes: "Déplace la luge au doigt, à la souris ou aux flèches ; touche ou espace pour lancer." },
  traineau: { creer: traineau, commandes: "Glisse dans une direction ou flèches. Toucher à gauche ou à droite tourne aussi." },
  boules: { creer: boules, commandes: "Touche les lutins dès qu'ils sortent. Pas les bonshommes de neige." },
  pile: { creer: pile, commandes: "Touche (ou espace) pour lâcher le paquet." },
};
