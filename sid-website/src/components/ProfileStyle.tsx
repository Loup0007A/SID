"use client";

import { useMemo } from "react";
import { scopeAndSanitizeCss, profileSkinClass } from "@/lib/profileCss";

/**
 * Injecte le CSS personnalisé (déjà nettoyé et scopé) d'UN membre pour
 * UNE zone du site (organigramme, trombinoscope, classement, profil).
 * À poser à l'intérieur d'un conteneur portant `profileSkinClass(userId)`
 * comme classe — c'est ce qui garantit que ce CSS ne peut styliser que ce
 * conteneur et ses enfants, jamais le reste de la page.
 */
export function ProfileStyle({ userId, css }: { userId: string; css: string | null | undefined }) {
  const scoped = useMemo(() => scopeAndSanitizeCss(css, profileSkinClass(userId)), [css, userId]);
  if (!scoped) return null;
  // Contenu texte simple (pas de HTML) : pas de risque à le rendre tel quel.
  return <style>{scoped}</style>;
}

export { profileSkinClass };
