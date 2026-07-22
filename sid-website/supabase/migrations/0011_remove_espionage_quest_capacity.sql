-- =========================================================
-- Retrait complet du système d'espionnage (fonctionnalité abandonnée)
-- =========================================================
drop function if exists public.espionner(uuid);
drop function if exists public.list_spyable_channels();
drop function if exists public.compute_spy_level(int);
drop table if exists public.spy_reports;
drop table if exists public.spy_roles;

alter table public.chat_channels drop constraint if exists chat_channels_dm_not_spyable;
alter table public.chat_channels drop column if exists spy_eligible;

delete from public.role_permissions where permission = 'manage_espionage';

alter table public.role_permissions drop constraint if exists role_permissions_permission_check;
alter table public.role_permissions add constraint role_permissions_permission_check check (permission in (
  'manage_roles','manage_org_chart','manage_quests','manage_shop',
  'manage_teams','manage_economy','recruit','manage_users'
));

-- =========================================================
-- Nombre de participants par quête (pour afficher "X / Y places" sans
-- exposer l'identité des participants à tout le monde via une simple
-- lecture de quest_participants, restreinte par RLS)
-- =========================================================
create or replace function public.quest_participant_counts()
returns table(quest_id uuid, participant_count bigint)
language sql
stable
security definer set search_path = public
as $$
  select quest_id, count(*) from public.quest_participants group by quest_id;
$$;

-- =========================================================
-- Permettre de supprimer une quête même si elle a déjà généré des
-- transactions (récompense versée) : on garde l'historique de la
-- transaction, on retire juste le lien vers la quête supprimée.
-- =========================================================
alter table public.transactions drop constraint if exists transactions_related_quest_id_fkey;
alter table public.transactions
  add constraint transactions_related_quest_id_fkey
  foreign key (related_quest_id) references public.quests(id) on delete set null;
