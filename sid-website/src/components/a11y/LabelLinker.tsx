"use client";

import { useEffect } from "react";

/**
 * Accessibilité des formulaires : beaucoup de champs du site sont écrits
 * « <label>Titre</label> <input/> » côte à côte, sans lien entre les deux.
 * Un lecteur d'écran annonce alors « zone de saisie » sans dire laquelle,
 * et cliquer sur l'étiquette ne place pas le curseur dans le champ.
 *
 * Ce composant relie chaque étiquette orpheline au champ qui la suit
 * (id + for), y compris sur les pages qui s'affichent plus tard. Les champs
 * qui ont déjà une étiquette ou un aria-label ne sont pas touchés.
 */
const CONTROL = 'input:not([type="hidden"]), select, textarea';
let seq = 0;

function hasName(el: Element) {
  const c = el as HTMLInputElement;
  return !!(c.labels && c.labels.length) || el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
}

function controlAfter(start: Element | null): Element | null {
  let sib = start;
  for (let k = 0; sib && k < 3; k++, sib = sib.nextElementSibling) {
    if (sib.tagName === "LABEL") return null; // l'étiquette suivante a son propre champ
    if (sib.matches(CONTROL)) return sib;
    const inner = sib.querySelector(CONTROL);
    if (inner) return inner;
  }
  return null;
}

function link(root: ParentNode) {
  root.querySelectorAll("label:not([for])").forEach((label) => {
    if (label.querySelector(CONTROL)) return; // champ dans l'étiquette : déjà lié
    let ctrl = controlAfter(label.nextElementSibling);
    // Étiquette posée dans une petite rangée (titre + lien « oublié ? ») : on
    // regarde après la rangée.
    if (!ctrl && label.parentElement && label.parentElement.querySelectorAll("label").length === 1 && !label.parentElement.querySelector(CONTROL))
      ctrl = controlAfter(label.parentElement.nextElementSibling);
    if (!ctrl || hasName(ctrl)) return;
    if (!ctrl.id) ctrl.id = `champ-${++seq}`;
    label.setAttribute("for", ctrl.id);
  });
}

export function LabelLinker() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => link(document));
    };
    run();
    const obs = new MutationObserver(run);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

/** Premier élément de la page au clavier : sauter l'en-tête. */
export function SkipLink({ target = "contenu", label = "Aller au contenu" }: { target?: string; label?: string }) {
  return (
    <a href={`#${target}`} className="skip-link">
      {label}
    </a>
  );
}
