-- =====================================================================
-- 0130 — Devlog : banque isolée (Lot 101)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-101-banque-isolee', 'central', 'Banque isolée',
   'Une banque à part, hors de l''économie du S.I.D. : pas d''intérêts, pas d''impôts, pas de saisie. Sur invitation seulement. On y dépose depuis son épargne ; chaque retrait est confirmé, décidé par la direction de la banque, attend 48 heures, puis revient sur l''épargne, dans la limite d''un plafond sur 7 jours. Elle apparaît dans la page Banque pour les membres qui y ont accès.', 'nouveau', '2026-11-22 21:00+01')
on conflict (slug) do nothing;
