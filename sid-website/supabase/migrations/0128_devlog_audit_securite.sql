-- =====================================================================
-- 0128 — Devlog : audit de sécurité (Lot 99)
-- Aucune table ne change. Peut être relancée.
-- =====================================================================
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-99-securite', 'central', 'Audit de sécurité',
   'Contrôle complet des droits de la base, de l''argent et des pages. Corrigé : les conversations privées et les missions sont mieux protégées, la gestion des comptes ne touche plus les fondateurs ni les autres administrateurs, les styles de fiche ne peuvent plus charger d''image extérieure ni déborder de la carte, les fichiers envoyés doivent être des images, et la messagerie limite les envois en rafale (40 messages par minute).', 'amelioration', '2026-11-22 19:00+01')
on conflict (slug) do nothing;
