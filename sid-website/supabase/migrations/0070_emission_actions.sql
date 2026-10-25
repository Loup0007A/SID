-- =========================================================
-- Lot 51 : le nombre d'actions suit la demande.
--
-- Avant : le stock d'actions d'une entreprise ne grossissait qu'une fois
-- par semaine au plus, et seulement si son chiffre d'affaires dépassait
-- 5 % de sa capitalisation (+2 % d'actions). Résultat : un stock presque
-- figé, vite vidé par les acheteurs (membres et population simulée).
--
-- Maintenant, deux mécanismes :
--
-- 1) ÉMISSION SUR DEMANDE (nouveau). Chaque action achetée au marché
--    primaire (le stock de l'entreprise) est comptée dans `demand_shares`
--    (un déclencheur s'en charge, quel que soit l'acheteur). Toutes les
--    8 heures au plus, si le stock disponible à l'achat est tombé sous
--    25 % du capital, l'entreprise émet de nouvelles actions : 80 % de ce
--    qui a été acheté depuis la dernière émission, entre 2 % et 20 % du
--    capital d'un coup. Une action revendue à l'entreprise retire une
--    unité de la demande.
--
-- 2) AUGMENTATION DE CAPITAL SUR ACTIVITÉ (0045), plus généreuse : seuil
--    de chiffre d'affaires 3 % (au lieu de 5 %), +4 % d'actions (au lieu de
--    2 %), tous les 3 jours au plus (au lieu de 7). Les réglages ne sont
--    changés que s'ils étaient encore aux valeurs d'origine.
--
-- Les actions neuves arrivent dans le stock de l'entreprise : elles ne
-- rapportent quelque chose que si quelqu'un les achète (l'argent entre
-- alors dans la trésorerie, comme pour toute action). Le fondateur est
-- prévenu par une notification. Tout est réglable dans app_config.
-- =========================================================

alter table public.businesses add column if not exists demand_shares int not null default 0;
alter table public.businesses add column if not exists last_issue_check_at timestamptz;

insert into public.app_config (key, value) values
  ('business_issue_float_target_pct', '0.25'),  -- on émet quand moins de 25 % du capital reste à vendre
  ('business_issue_demand_ratio', '0.8'),       -- 80 % des actions achetées depuis la dernière émission
  ('business_issue_min_pct', '0.02'),           -- au moins 2 % du capital par émission
  ('business_issue_max_pct', '0.2'),            -- au plus 20 % du capital par émission
  ('business_issue_interval_hours', '8')        -- au plus une émission toutes les 8 h par entreprise
on conflict (key) do nothing;

update public.app_config set value = '0.03' where key = 'business_growth_revenue_threshold_pct' and value = '0.05';
update public.app_config set value = '0.04' where key = 'business_growth_share_increase_pct' and value = '0.02';
update public.app_config set value = '3' where key = 'business_growth_min_interval_days' and value = '7';

-- ---------------------------------------------------------
-- Compteur de demande : toute baisse du stock de l'entreprise à capital
-- constant est un achat ; toute hausse à capital constant est un rachat.
-- (Les émissions changent le capital et ne sont donc pas comptées.)
-- ---------------------------------------------------------
create or replace function public.track_share_demand()
returns trigger
language plpgsql
as $$
begin
  if new.share_count = old.share_count and new.shares_in_treasury is distinct from old.shares_in_treasury then
    if new.shares_in_treasury < old.shares_in_treasury then
      new.demand_shares := coalesce(old.demand_shares, 0) + (old.shares_in_treasury - new.shares_in_treasury);
    else
      new.demand_shares := greatest(0, coalesce(old.demand_shares, 0) - (new.shares_in_treasury - old.shares_in_treasury));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_track_share_demand on public.businesses;
create trigger businesses_track_share_demand
  before update of shares_in_treasury on public.businesses
  for each row execute function public.track_share_demand();

-- Entreprises déjà à court d'actions au moment de la migration : toute
-- action hors du stock a été achetée (une entreprise naît avec tout son
-- capital en stock), on reprend donc ces achats comme demande de départ.
-- Sans ça, une entreprise vidée ne pourrait plus jamais déclencher
-- d'émission (plus rien à acheter = plus de demande comptée).
update public.businesses
  set demand_shares = share_count - shares_in_treasury
  where not is_closed
    and last_issue_check_at is null
    and demand_shares = 0
    and share_count > shares_in_treasury
    and shares_in_treasury::numeric < public.get_config_numeric('business_issue_float_target_pct', 0.25) * share_count;

-- ---------------------------------------------------------
-- Notification au fondateur : nouveau type « business ».
-- ---------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision', 'quest_confirmation_needed',
  'travel_arrived', 'salary_paid', 'money_received', 'sanction', 'announcement', 'raid_call', 'admin_alert',
  'title', 'troll', 'business'
]));

-- ---------------------------------------------------------
-- Émission sur demande.
-- ---------------------------------------------------------
create or replace function public.process_share_issuance()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_target numeric := public.get_config_numeric('business_issue_float_target_pct', 0.25);
  v_ratio numeric := public.get_config_numeric('business_issue_demand_ratio', 0.8);
  v_min_pct numeric := public.get_config_numeric('business_issue_min_pct', 0.02);
  v_max_pct numeric := public.get_config_numeric('business_issue_max_pct', 0.2);
  v_hours numeric := public.get_config_numeric('business_issue_interval_hours', 8);
  r record;
  v_new int;
  v_count int := 0;
begin
  for r in
    select * from public.businesses
    where not is_closed
      and (last_issue_check_at is null or last_issue_check_at <= now() - (v_hours || ' hours')::interval)
    for update skip locked
  loop
    if r.share_count > 0
       and r.shares_in_treasury::numeric < v_target * r.share_count
       and r.demand_shares > 0 then
      v_new := round(r.demand_shares * v_ratio)::int;
      v_new := greatest(v_new, ceil(r.share_count * v_min_pct)::int, 1);
      v_new := least(v_new, greatest(1, ceil(r.share_count * v_max_pct)::int));

      update public.businesses
        set share_count = share_count + v_new,
            shares_in_treasury = shares_in_treasury + v_new,
            demand_shares = 0,
            last_issue_check_at = now()
        where id = r.id;

      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (r.id, 0, 'Émission de ' || v_new || ' action(s) neuves : forte demande (' || r.demand_shares || ' achetée(s) depuis la dernière émission)', null);

      insert into public.notifications (user_id, type, title, body, link)
      values (
        r.founder_id, 'business',
        '📈 ' || r.name || ' émet ' || v_new || ' action(s)',
        'Tes actions partent vite : ' || r.demand_shares || ' achetée(s) depuis la dernière émission. ' ||
        v_new || ' action(s) neuves sont maintenant en vente (' || (r.share_count + v_new) || ' au total).',
        '/dashboard/business'
      );

      v_count := v_count + 1;
    else
      -- Rien à émettre : on repousse la vérification. Si le stock est
      -- confortable, la demande accumulée est oubliée.
      update public.businesses
        set last_issue_check_at = now(),
            demand_shares = case when r.shares_in_treasury::numeric >= v_target * r.share_count then 0 else demand_shares end
        where id = r.id;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.process_share_issuance() from public, anon, authenticated;

create or replace function public.process_daily_economy()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.process_daily_economy_core();
  perform public.process_market();
  perform public.expire_sanctions();
  perform public.process_business_growth();
  perform public.process_share_issuance();
end;
$$;

-- Réglages publics du marché (bourse et page Entreprise).
create or replace function public.get_market_settings()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'liquidity_factor', public.get_config_numeric('market_liquidity_factor', 2),
    'fee_rate', public.get_config_numeric('market_fee_rate', 0.002),
    'admin_fee_per_share', public.get_config_numeric('market_admin_fee_per_share', 0.5),
    'min_holding_minutes', public.get_config_numeric('market_min_holding_minutes', 30),
    'tick_minutes', public.get_config_numeric('market_tick_minutes', 60),
    'default_share_count', public.get_config_numeric('business_default_share_count', 1000),
    'min_initial_investment', public.get_config_numeric('business_min_initial_investment', 500),
    'growth_revenue_threshold_pct', public.get_config_numeric('business_growth_revenue_threshold_pct', 0.03),
    'growth_share_increase_pct', public.get_config_numeric('business_growth_share_increase_pct', 0.04),
    'growth_min_interval_days', public.get_config_numeric('business_growth_min_interval_days', 3),
    'issue_float_target_pct', public.get_config_numeric('business_issue_float_target_pct', 0.25),
    'issue_demand_ratio', public.get_config_numeric('business_issue_demand_ratio', 0.8),
    'issue_min_pct', public.get_config_numeric('business_issue_min_pct', 0.02),
    'issue_max_pct', public.get_config_numeric('business_issue_max_pct', 0.2),
    'issue_interval_hours', public.get_config_numeric('business_issue_interval_hours', 8)
  );
$$;
