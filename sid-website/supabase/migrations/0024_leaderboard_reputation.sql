-- =========================================================
-- Système de classement : argent (déjà dans wallets), renommée (nouvelle
-- statistique manuelle, comme le solde) et quêtes accomplies (déduit des
-- participations validées).
-- =========================================================

alter table public.profiles add column reputation int not null default 0;

-- Ajustement manuel de la renommée, même logique qu'adjust_wallet.
create or replace function public.adjust_reputation(p_user_id uuid, p_amount int, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (public.has_permission(auth.uid(), 'manage_economy') or public.has_permission(auth.uid(), 'manage_users')) then
    raise exception 'Permission refusée';
  end if;

  update public.profiles set reputation = reputation + p_amount where id = p_user_id;
end;
$$;

-- Classement complet, visible par tout membre actif (pas de donnée
-- sensible : pseudo, solde, renommée, nombre de quêtes validées).
create or replace function public.list_leaderboard()
returns table (
  user_id uuid,
  nickname text,
  balance numeric,
  reputation int,
  quests_completed bigint
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id,
    p.nickname,
    coalesce(w.balance, 0),
    p.reputation,
    coalesce(qc.cnt, 0)
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  left join (
    select user_id, count(*) as cnt
    from public.quest_participants
    where status = 'validated'
    group by user_id
  ) qc on qc.user_id = p.id
  where p.status = 'active';
$$;
