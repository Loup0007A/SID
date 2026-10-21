# Lot 42 : titres d'événement

**Migration : `supabase/migrations/0065_titres_evenement.sql`** (après 0064, peut
être relancée). Une partie est scellée, comme 0061.

Chaque événement a désormais son titre. Il ne s'obtient **que pendant
l'événement** (quand son affichage est actif, réglé dans Modération), puis se
garde pour toujours. Comme les autres titres, il transforme le dossier une fois
équipé et donne un pouvoir de farce.

| Titre | Événement | Pouvoir |
|---|---|---|
| 🦇 Maître des Chauves-Souris | 🎃 Halloween | **Nuée** : des nuées de chauves-souris traversent l'écran de la cible, quelques-unes s'accrochent en haut des pages et il faut cliquer pour les chasser (elles reviennent). Réglages : taille des nuées, nombre d'accrochées. |
| 🧝 Lutin Clandestin | 🎄 Noël | **Blizzard** : tempête de neige sur le site de la cible, le givre envahit l'écran et il faut frotter (souris ou doigt) pour y voir clair. Réglages : force de la tempête, givre ou non. |

La façon de les obtenir est scellée (`scripts/scelle/`) ; les membres voient
une énigme et, sur la page Titres, une section « Titres d'événement » qui dit si
le titre est à chercher maintenant ou quand il reviendra.

## Ajouter le titre d'un prochain événement
1. Son affichage : une clé dans `site_decor` / `set_site_decor` (comme 0064 pour Noël).
2. Son titre : une ligne dans `titles` avec `event` = cette clé, et l'entrée dans
   `src/lib/titles.ts` (`event: "…"`, et l'événement dans `EVENTS`).
3. Sa règle d'obtention et son apparition sur le site : dans la partie scellée
   (`.scelle/sql/0065…`, `_event_rule`) et un composant scellé (`.scelle/composants/`),
   puis `scelle.mjs sceller`.
4. Son pouvoir : options (`trollOptions.ts`, `_troll_params`), panneau de réglages,
   effet (`components/trolls/`).
