"use client";

import { useEffect } from "react";
import { zoneLibre } from "@/components/trolls/placeLibre";

/**
 * Garde des boutons : les objets d'événement immobiles (créatures cachées,
 * traces de chasse, chauves-souris suspendues, poissons, œufs) ne restent
 * jamais posés sur un bouton, un lien ou un champ. Un objet qui en recouvre
 * un (à son arrivée, ou parce que la page a défilé dessous) est décalé avec
 * la propriété CSS `translate`, qui s'ajoute à son placement sans le
 * remplacer : le code des événements, y compris celui des titres scellés,
 * n'est pas modifié. Les objets en mouvement sont laissés passer. La grève
 * vise un bouton exprès : elle n'est pas concernée.
 */
const OBJETS = ".ev9-hidden, .hunt-trail, .troll-bat-hang, .troll-stuck-fish, .troll-choco-egg, .ev-lone-bat, [data-objet-evenement]";

const PAS = 36;
const DECALAGES: [number, number][] = [];
for (let r = 1; r <= 6; r++) {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) DECALAGES.push([dx * r * PAS, dy * r * PAS]);
}

function decaler(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
  // L'objet lui-même est ignoré par zoneLibre (calques d'événement marqués).
  el.setAttribute("data-troll-ui", "");
  if (zoneLibre(r.left, r.top, r.width, r.height)) return;
  const [ox, oy] = (el.dataset.garde ?? "0 0").split(" ").map(Number);
  for (const [dx, dy] of DECALAGES) {
    const x = r.left + dx;
    const y = r.top + dy;
    if (x < 4 || y < 4 || x + r.width > innerWidth - 4 || y + r.height > innerHeight - 4) continue;
    if (zoneLibre(x, y, r.width, r.height)) {
      el.dataset.garde = `${ox + dx} ${oy + dy}`;
      el.style.translate = `${ox + dx}px ${oy + dy}px`;
      return;
    }
  }
}

export function GardeBoutons() {
  useEffect(() => {
    const avant = new WeakMap<Element, string>();
    const tour = () => {
      for (const el of document.querySelectorAll<HTMLElement>(OBJETS)) {
        if (el.classList.contains("is-leaving") || el.classList.contains("is-peeling") || el.classList.contains("is-eaten")) continue;
        const r = el.getBoundingClientRect();
        const cle = `${Math.round(r.left)},${Math.round(r.top)}`;
        // Immobile depuis le tour précédent : on vérifie ce qu'il recouvre.
        if (avant.get(el) === cle) decaler(el);
        avant.set(el, cle);
      }
    };
    const t = setInterval(tour, 700);
    return () => clearInterval(t);
  }, []);
  return null;
}
