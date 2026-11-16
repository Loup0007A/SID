"use client";

import { setBrand, type Brand } from "@/lib/brand";
import { primeGlitched, type GlitchedMember } from "@/lib/glitch";

/**
 * Pose l'identité du jeu (Lot 77) avant que le reste de la page ne s'affiche :
 * ce composant est rendu avant ses enfants, côté serveur comme dans le
 * navigateur. Pose aussi la liste des membres en lieu inconnu (Lot 81) lue
 * par le serveur, pour que la page s'hydrate comme elle a été rendue.
 */
export function BrandProvider({ brand, glitched = [], children }: { brand: Brand; glitched?: GlitchedMember[]; children: React.ReactNode }) {
  setBrand(brand);
  primeGlitched(glitched);
  return <>{children}</>;
}
