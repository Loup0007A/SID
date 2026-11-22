"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";

/**
 * Épingles (Lot 98, migration 0125 du Dossier Central). Fichier identique
 * dans les trois dépôts (npm run communs).
 *
 * Un membre épingle des membres, des quêtes, des lieux et des bâtiments ;
 * les fiches du Wiki épinglées sont ses favoris. mes_epingles() renvoie le
 * tout avec le nom et l'adresse du jour, sans ce qu'il ne peut plus voir.
 *
 *  - useEpingles(ici) : la liste (chargée une fois par page, partagée par
 *    tous les composants, rechargée après chaque changement) ;
 *  - <BoutonEpingle kind="lieu" cible={id} /> : épingler / retirer ;
 *  - adresse(), siteOuvert() : liens vers les trois sites (aussi utilisés
 *    par RechercheCommune).
 */

export type SiteSid = "main" | "wiki" | "map";
export type KindEpingle = "membre" | "quete" | "fiche" | "lieu" | "batiment";
export type Epingle = {
  site: SiteSid;
  kind: KindEpingle;
  id: string;
  label: string;
  hint?: string;
  path: string;
  image?: string | null;
  href: string;
  external: boolean;
};
type Brut = Omit<Epingle, "href" | "external">;

/** Le site est-il ouvert (le Wiki et la Carto peuvent être fermés par l'administration) ? */
export function siteOuvert(s: SiteSid, ici: SiteSid) {
  if (s === ici || s === "main") return true;
  return s === "wiki" ? !!BRAND.sites.wiki : !!BRAND.sites.map;
}

/** Adresse relative sur le site courant, complète vers les deux autres. */
export function adresse(site: SiteSid, path: string, ici: SiteSid) {
  if (site === ici) return path;
  const base = site === "main" ? BRAND.urls.site : site === "wiki" ? BRAND.urls.wiki : BRAND.urls.map;
  return `${base.replace(/\/$/, "")}${path}`;
}

export const ICONES_KIND: Record<KindEpingle | "objet", string> = { membre: "👤", quete: "📜", objet: "🛒", fiche: "📖", lieu: "📍", batiment: "🏛" };

const EVENT = "sid:epingles";
let liste: Brut[] | null = null;
let erreur: string | null = null;
let enCours: Promise<void> | null = null;

function charger(): Promise<void> {
  enCours = (async () => {
    const { data, error } = await createClient().rpc("mes_epingles");
    if (error) {
      erreur = /mes_epingles|PGRST202/.test(`${error.message} ${error.code}`) ? "Les épingles arrivent avec la migration 0125." : error.message;
      liste = liste ?? [];
    } else {
      erreur = null;
      liste = (data ?? []) as Brut[];
    }
    window.dispatchEvent(new Event(EVENT));
  })();
  return enCours;
}

/** À appeler après un changement fait ailleurs (bouton Favori du Wiki…). */
export function rechargerEpingles() {
  return charger();
}

export function useEpingles(ici: SiteSid, actif = true) {
  const [, setTour] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const maj = () => setTour((n) => n + 1);
    window.addEventListener(EVENT, maj);
    if (!enCours) void charger();
    return () => window.removeEventListener(EVENT, maj);
  }, [actif]);
  const epingles: Epingle[] | null = liste
    ? liste.filter((e) => siteOuvert(e.site, ici)).map((e) => ({ ...e, href: adresse(e.site, e.path, ici), external: e.site !== ici }))
    : null;
  return { epingles, erreur };
}

export function estEpingle(kind: KindEpingle, cible: string) {
  return !!liste?.some((e) => e.kind === kind && e.id === cible);
}

/** Épingler ou retirer ; renvoie l'erreur à afficher, ou null. */
export async function basculerEpingle(kind: KindEpingle, cible: string): Promise<string | null> {
  const { error } = await createClient().rpc("epingle_basculer", { p_kind: kind, p_ref: cible });
  if (error) return /epingle_basculer|PGRST202/.test(`${error.message} ${error.code}`) ? "Les épingles arrivent avec la migration 0125." : error.message;
  await charger();
  return null;
}

export function BoutonEpingle({
  kind,
  cible,
  ici,
  nom,
  className = "epingle-bouton",
}: {
  kind: KindEpingle;
  cible: string;
  ici: SiteSid;
  /** Nom de l'élément, pour les lecteurs d'écran. */
  nom?: string;
  className?: string;
}) {
  const { epingles } = useEpingles(ici);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const on = !!epingles?.some((e) => e.kind === kind && e.id === cible);

  async function basculer() {
    setOccupe(true);
    setMessage(null);
    const err = await basculerEpingle(kind, cible);
    setOccupe(false);
    if (err) setMessage(err);
  }

  return (
    <>
      <button
        type="button"
        onClick={basculer}
        disabled={occupe || epingles === null}
        aria-pressed={on}
        className={className}
        title={on ? "Retirer de mes épingles" : "Épingler : retrouvable sur les trois sites (Ctrl+K)"}
        aria-label={`${on ? "Retirer des épingles" : "Épingler"}${nom ? ` : ${nom}` : ""}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z" />
          <path d="M12 13v8" />
        </svg>
        <span>{on ? "Épinglé" : "Épingler"}</span>
      </button>
      {message && (
        <span role="alert" className="epingle-erreur">
          {message}
        </span>
      )}
    </>
  );
}
