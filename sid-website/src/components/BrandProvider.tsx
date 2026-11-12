"use client";

import { setBrand, type Brand } from "@/lib/brand";

/**
 * Pose l'identité du jeu (Lot 77) avant que le reste de la page ne s'affiche :
 * ce composant est rendu avant ses enfants, côté serveur comme dans le
 * navigateur.
 */
export function BrandProvider({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  setBrand(brand);
  return <>{children}</>;
}
