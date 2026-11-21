-- =====================================================================
-- 0109 — Devlog : les alliés agissent dans les simulations (Lot 89)
-- Aucune table ne change : les pouvoirs sont calculés par le site
-- (src/lib/allyPowers.ts) et appliqués par les jeux. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-89', 'central', 'Les alliés jouent avec toi',
   'Sages, Artisans et Compagnons ne font plus seulement annuler un échec : ils agissent pendant chaque partie, à tous les niveaux, 101 compris. Chaque allié a une **spécialité** tirée de son nom (deux pour un Divin), et sa force (de 1 à 10) dépend de son rang et de son éveil.

**Sages (Intelligence)** : Clairvoyant (indices), Gardien du sablier (temps en plus), Mentor (erreurs pardonnées), Érudit (carnet complet, brouillard levé, forme des réponses).

**Artisans (Techniques)** : Horloger (délais allongés), Gabarit (cibles plus grandes, moins de répétitions), Contremaître (ateliers ratés validés), Second d''atelier (ateliers faits à ta place).

**Compagnons (Donjons)** : Lame (frappe les ennemis), Bouclier (coups absorbés, dégâts réduits), Soigneur (soin, relève sur place), Éclaireur (vitesse, butin, lumière sur les reliques).

La page de chaque simulation et le dex décrivent ce que fait ton allié.', 'nouveau', '2026-11-21 18:00+01')
on conflict (slug) do nothing;
