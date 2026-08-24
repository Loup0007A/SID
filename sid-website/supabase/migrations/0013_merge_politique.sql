-- =========================================================
-- Fusion des catégories "Politique" et "Politique X" : on ne garde que
-- l'entrée "politique_x" (couleur rose), rebaptisée "Politique" côté
-- interface. Les quêtes existantes marquées "politique" basculent dessus.
-- =========================================================
update public.quests set contract_type = 'politique_x' where contract_type = 'politique';

alter table public.quests drop constraint if exists quests_contract_type_check;
alter table public.quests add constraint quests_contract_type_check check (contract_type in (
  'tuer',
  'chasse',
  'raid',
  'autres',
  'missions_exterieures',
  'espionnage',
  'politique_x',
  'collecte_vol'
));
