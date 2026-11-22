"use client";

import Link from "next/link";
import { ICONES_KIND, useEpingles, type Epingle } from "@/components/Epingles";
import { NOMS_SITES } from "@/components/RechercheCommune";

/**
 * Épingles sur l'accueil (Lot 98) : membres, quêtes, fiches du Wiki, lieux
 * et bâtiments épinglés, sous les raccourcis de pages. Rien si la liste
 * est vide (le bouton « Épingler » est sur chaque fiche, quête, lieu…).
 */
export function EpinglesAccueil() {
  const { epingles } = useEpingles("main");
  if (!epingles?.length) return null;
  const montre = epingles.slice(0, 12);

  return (
    <section aria-labelledby="epingles-titre" className="epingles-accueil">
      <h2 id="epingles-titre" className="font-mono text-xs uppercase tracking-[0.25em] text-paper/65">
        Épinglés
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {montre.map((e) => (
          <Puce key={`${e.kind}-${e.id}`} e={e} />
        ))}
        {epingles.length > montre.length && <span className="font-mono text-xs text-paper/70">+{epingles.length - montre.length} (Ctrl+K)</span>}
      </div>
    </section>
  );
}

function Puce({ e }: { e: Epingle }) {
  const contenu = (
    <>
      {e.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.image} alt="" className="h-6 w-6 rounded-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{ICONES_KIND[e.kind]}</span>
      )}
      <span>{e.label}</span>
      {e.external && <span className="sr-only"> ({NOMS_SITES[e.site]}, nouvel onglet)</span>}
      {e.external && (
        <span aria-hidden className="epingle-ailleurs">
          ↗
        </span>
      )}
    </>
  );
  const titre = [e.hint, e.external ? NOMS_SITES[e.site] : null].filter(Boolean).join(" · ");
  return e.external ? (
    <a href={e.href} target="_blank" rel="noopener" className="pins-chip" title={titre}>
      {contenu}
    </a>
  ) : (
    <Link href={e.href} className="pins-chip" title={titre}>
      {contenu}
    </Link>
  );
}
