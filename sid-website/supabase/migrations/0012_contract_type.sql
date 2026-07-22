-- =========================================================
-- Type de contrat (catégorie visuelle façon "code couleur")
-- =========================================================
alter table public.quests add column contract_type text not null default 'autres'
  check (contract_type in (
    'politique',
    'tuer',
    'chasse',
    'raid',
    'autres',
    'missions_exterieures',
    'espionnage',
    'politique_x',
    'collecte_vol'
  ));
