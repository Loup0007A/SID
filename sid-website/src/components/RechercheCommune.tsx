"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";

/**
 * Recherche commune aux trois sites (Lot 96). Fichier identique dans les
 * trois dépôts (npm run communs).
 *
 * Une seule fonction en base (recherche_commune_limitee, migration 0121)
 * cherche les membres, quêtes et objets du Dossier Central, les fiches du
 * Wiki et les lieux et bâtiments de la Cartographie, avec les règles de
 * chaque site (fiches découvertes, lieux parcourus, comptes invisibles…).
 *
 *  - useRechercheCommune(texte, ici) : les résultats, avec leur adresse
 *    (relative sur le site courant, complète vers les deux autres) ;
 *  - <RechercheCommune ici="wiki" /> : la fenêtre (Ctrl+K ou ⌘K), pour le
 *    Wiki et la Cartographie. Le Dossier Central garde sa palette, qui
 *    reçoit les résultats des deux autres sites ;
 *  - <BoutonRechercheCommune /> : le bouton qui l'ouvre.
 * Styles : classes rc-* de chaque globals.css.
 */

export type SiteSid = "main" | "wiki" | "map";
export type ResultatCommun = {
  site: SiteSid;
  kind: "membre" | "quete" | "objet" | "fiche" | "lieu" | "batiment";
  id: string;
  label: string;
  hint?: string;
  path: string;
  image?: string | null;
  href: string;
  external: boolean;
};

export const NOMS_SITES: Record<SiteSid, string> = { main: "Dossier Central", wiki: "Wiki", map: "Cartographie" };
const ORDRE: SiteSid[] = ["main", "wiki", "map"];
const OPEN_EVENT = "sid:recherche-commune";

/** Ouvre la fenêtre de recherche commune (Wiki, Cartographie). */
export function ouvrirRechercheCommune() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function siteOuvert(s: SiteSid, ici: SiteSid) {
  if (s === ici || s === "main") return true;
  return s === "wiki" ? !!BRAND.sites.wiki : !!BRAND.sites.map;
}

function adresse(site: SiteSid, path: string, ici: SiteSid) {
  if (site === ici) return path;
  const base = site === "main" ? BRAND.urls.site : site === "wiki" ? BRAND.urls.wiki : BRAND.urls.map;
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Résultats pour un texte (au moins 2 lettres), demandés 200 ms après la dernière frappe. */
export function useRechercheCommune(texte: string, ici: SiteSid, actif = true) {
  const [resultats, setResultats] = useState<ResultatCommun[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const tour = useRef(0);

  useEffect(() => {
    const q = texte.trim();
    if (!actif || q.length < 2) {
      setResultats([]);
      setChargement(false);
      setErreur(null);
      return;
    }
    const n = ++tour.current;
    setChargement(true);
    const t = window.setTimeout(async () => {
      const { data, error } = await createClient().rpc("recherche_commune_limitee", { p_q: q });
      if (n !== tour.current) return;
      setChargement(false);
      if (error) {
        setResultats([]);
        setErreur(/recherche_commune|PGRST202/.test(`${error.message} ${error.code}`) ? "Recherche commune pas encore installée (migration 0121)." : error.message);
        return;
      }
      setErreur(null);
      setResultats(
        ((data ?? []) as Omit<ResultatCommun, "href" | "external">[])
          .filter((r) => siteOuvert(r.site, ici))
          .map((r) => ({ ...r, href: adresse(r.site, r.path, ici), external: r.site !== ici })),
      );
    }, 200);
    return () => window.clearTimeout(t);
  }, [texte, ici, actif]);

  return { resultats, chargement, erreur };
}

const ICONES: Record<ResultatCommun["kind"], string> = { membre: "👤", quete: "📜", objet: "🛒", fiche: "📖", lieu: "📍", batiment: "🏛" };

export function BoutonRechercheCommune({ className = "rc-bouton", children }: { className?: string; children?: React.ReactNode }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={ouvrirRechercheCommune}
      className={className}
      aria-label={`Chercher sur les trois sites (${mac ? "⌘" : "Ctrl"}+K)`}
      title={`Chercher sur les trois sites (${mac ? "⌘" : "Ctrl"}+K)`}
      aria-keyshortcuts="Control+K Meta+K"
    >
      {children ?? (
        <>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="rc-bouton-texte">Trois sites</span>
        </>
      )}
    </button>
  );
}

export default function RechercheCommune({ ici }: { ici: SiteSid }) {
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const { resultats, chargement, erreur } = useRechercheCommune(texte, ici, open);

  // Ouverture : seulement avec une session (pas sur la page de connexion).
  const ouvrir = useCallback(async () => {
    const { data } = await createClient().auth.getSession();
    if (!data.session) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else ouvrir();
      }
    };
    const onOpen = () => ouvrir();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [open, ouvrir]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setTexte("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => returnFocus.current?.focus?.());
  }, []);

  // Le site courant d'abord, puis les deux autres.
  const groupes = useMemo(() => {
    const ordre = [ici, ...ORDRE.filter((s) => s !== ici)];
    return ordre.map((s) => ({ site: s, items: resultats.filter((r) => r.site === s) })).filter((g) => g.items.length > 0);
  }, [resultats, ici]);
  const flat = useMemo(() => groupes.flatMap((g) => g.items), [groupes]);
  useEffect(() => setActive(0), [resultats]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choisir(r: ResultatCommun | undefined) {
    if (!r) return;
    setOpen(false);
    if (r.external) window.open(r.href, "_blank", "noopener");
    else window.location.assign(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const n = flat.length;
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setActive((a) => (n ? (a + 1) % n : 0));
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setActive((a) => (n ? (a - 1 + n) % n : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choisir(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;
  const q = texte.trim();
  let idx = -1;

  return createPortal(
    <div className="rc-fond" onMouseDown={close}>
      <div className="rc-fenetre" role="dialog" aria-modal="true" aria-label="Chercher sur les trois sites" onMouseDown={(e) => e.stopPropagation()}>
        <div className="rc-champ">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Un membre, une quête, une fiche, un lieu…"
            role="combobox"
            aria-expanded="true"
            aria-controls="rc-liste"
            aria-activedescendant={flat[active] ? `rc-opt-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="rc-fermer" onClick={close}>
            Fermer
          </button>
        </div>
        <div ref={listRef} id="rc-liste" role="listbox" aria-label="Résultats" className="rc-liste">
          {groupes.map((g) => (
            <div key={g.site} role="group" aria-label={NOMS_SITES[g.site]}>
              <p className="rc-groupe" aria-hidden>
                {NOMS_SITES[g.site]}
                {g.site !== ici && <span className="rc-ailleurs"> · nouvel onglet</span>}
              </p>
              {g.items.map((r) => {
                idx++;
                const i = idx;
                return (
                  <div
                    key={`${r.kind}-${r.id}`}
                    id={`rc-opt-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                    className={`rc-opt${i === active ? " is-active" : ""}`}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choisir(r)}
                  >
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="rc-image" loading="lazy" />
                    ) : (
                      <span className="rc-icone" aria-hidden>
                        {ICONES[r.kind]}
                      </span>
                    )}
                    <span className="rc-textes">
                      <span className="rc-titre">{r.label}</span>
                      {r.hint && <span className="rc-detail">{r.hint}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {q.length < 2 && <p className="rc-vide">Tape au moins deux lettres. La recherche couvre le Dossier Central, le Wiki et la Cartographie.</p>}
          {q.length >= 2 && flat.length === 0 && (
            <p className="rc-vide" role="status">
              {erreur ?? (chargement ? "Recherche en cours…" : <>Rien ne correspond à « {q} ».</>)}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { RechercheCommune };
