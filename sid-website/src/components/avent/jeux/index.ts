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
  babyfoot: { creer: babyfoot, commandes: "Chaque barre bouge seule : pose un doigt près d'une barre et glisse (plusieurs doigts possibles), ou survole-la à la souris. Clavier : ↑ ↓ ou 1, 2, 3 pour choisir, ← → pour bouger." },
  bowling: { creer: bowling, commandes: "Touche (ou espace) trois fois : départ, direction, puissance. Tiens compte du verglas." },
  glouton: { creer: glouton, commandes: "Glisse le doigt dans une direction, ou flèches." },
  cassebriques: { creer: cassebriques, commandes: "Déplace la luge au doigt, à la souris ou aux flèches ; touche ou espace pour lancer." },
  traineau: { creer: traineau, commandes: "Glisse dans une direction ou flèches. Toucher à gauche ou à droite tourne aussi." },
  boules: { creer: boules, commandes: "Touche les lutins dès qu'ils sortent. Pas les bonshommes de neige." },
  pile: { creer: pile, commandes: "Touche (ou espace) pour lâcher le paquet." },
};
