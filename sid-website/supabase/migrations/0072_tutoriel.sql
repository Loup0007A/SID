-- =========================================================
-- Lot 53 : le tuto du Dossier Central.
-- À lancer après 0071. Peut être relancée sans risque.
--
--   * Dossier d'intégration (accueil des nouveaux), visite guidée,
--     astuces de première visite : où en est chaque membre, gardé en base
--     pour suivre d'un appareil à l'autre.
--   * Premiers pas : vérifiés côté serveur (rien à cocher soi-même).
--   * Prime d'intégration : versée une seule fois, quand la visite est
--     terminée et qu'au moins 5 des 7 premiers pas sont faits
--     (montant : app_config.onboarding_reward, 1 000 z par défaut).
-- =========================================================

create table if not exists public.onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  briefing_seen_at timestamptz,
  tour_step int not null default 0,
  tour_done_at timestamptz,
  tour_skipped_at timestamptz,
  tips_seen text[] not null default '{}',
  reward_claimed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.onboarding enable row level security;
drop policy if exists onboarding_read_own on public.onboarding;
create policy onboarding_read_own on public.onboarding for select to authenticated using (user_id = auth.uid());

insert into public.app_config (key, value) values
  ('onboarding_reward', '1000'),
  ('onboarding_reward_min_steps', '5')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- Les premiers pas, calculés à partir de ce que le membre a vraiment fait.
-- Chaque vérification est protégée : une table absente compte comme « pas
-- encore fait » au lieu de tout faire échouer.
-- ---------------------------------------------------------
create or replace function public._onboarding_steps(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  b boolean;
begin
  select coalesce(avatar_url, '') <> '' and length(trim(coalesce(description, ''))) >= 20 into b from public.profiles where id = p_uid;
  v := v || jsonb_build_object('dossier', coalesce(b, false));

  begin
    execute 'select exists (select 1 from public.character_positions where user_id = $1 and (place_id is not null or travel_started_at is not null))' into b using p_uid;
  exception when others then b := false; end;
  v := v || jsonb_build_object('position', coalesce(b, false));

  begin
    select exists (select 1 from public.quest_participants where user_id = p_uid) into b;
  exception when others then b := false; end;
  v := v || jsonb_build_object('quete', coalesce(b, false));

  begin
    select exists (select 1 from public.simulation_runs where user_id = p_uid and status = 'success') into b;
  exception when others then b := false; end;
  v := v || jsonb_build_object('simulation', coalesce(b, false));

  begin
    select exists (select 1 from public.tech_purchases where user_id = p_uid) into b;
  exception when others then b := false; end;
  v := v || jsonb_build_object('techno', coalesce(b, false));

  begin
    select exists (select 1 from public.chat_messages where sender_id = p_uid and not coalesce(is_deleted, false)) into b;
  exception when others then b := false; end;
  v := v || jsonb_build_object('message', coalesce(b, false));

  begin
    select coalesce((select balance > 0 from public.bank_accounts where user_id = p_uid), false)
        or exists (select 1 from public.purchases where user_id = p_uid)
      into b;
  exception when others then b := false; end;
  v := v || jsonb_build_object('argent', coalesce(b, false));

  return v;
end;
$$;

revoke execute on function public._onboarding_steps(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- Tout ce dont le tuto a besoin, en un appel : où en est le membre, ses
-- premiers pas, la prime, et les vrais chiffres du jeu (taux, limites…)
-- pour que les textes ne mentent jamais.
-- ---------------------------------------------------------
create or replace function public.get_onboarding()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  o public.onboarding;
  v_steps jsonb;
  v_done int;
  v_created timestamptz;
  v_salary numeric;
begin
  if v_uid is null then return null; end if;
  insert into public.onboarding (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into o from public.onboarding where user_id = v_uid;
  select created_at into v_created from public.profiles where id = v_uid;
  v_steps := public._onboarding_steps(v_uid);
  select count(*) into v_done from jsonb_each(v_steps) where value = 'true'::jsonb;
  begin
    select amount into v_salary from public.salaries where user_id = v_uid and is_active;
  exception when others then v_salary := null; end;

  return jsonb_build_object(
    'briefing_seen', o.briefing_seen_at is not null,
    'tour_step', o.tour_step,
    'tour_done', o.tour_done_at is not null,
    'tour_skipped', o.tour_skipped_at is not null,
    'tips_seen', to_jsonb(o.tips_seen),
    'reward_claimed', o.reward_claimed_at is not null,
    'is_new', coalesce(v_created > now() - interval '7 days', false),
    'steps', v_steps,
    'steps_done', v_done,
    'reward', public.get_config_numeric('onboarding_reward', 1000),
    'reward_min_steps', public.get_config_numeric('onboarding_reward_min_steps', 5),
    'numbers', jsonb_build_object(
      'salary', v_salary,
      'bank_rate', public.get_config_numeric('bank_daily_interest_rate', 0.01),
      'debt_rate', public.get_config_numeric('debt_daily_interest_rate', 0.02),
      'max_debt', public.get_config_numeric('max_debt_principal', 50000),
      'vat', public.get_config_numeric('vat_rate', 0.05),
      'wealth_tax', public.get_config_numeric('weekly_wealth_tax_rate', 0.02),
      'sim_per_day', public.get_config_numeric('simulation_max_results_per_day', 10),
      'injury_minutes', public.get_config_numeric('simulation_injury_minutes', 60),
      'min_holding_minutes', public.get_config_numeric('market_min_holding_minutes', 30)
    )
  );
end;
$$;

-- Ce que fait le membre dans le tuto.
create or replace function public.onboarding_event(p_event text, p_value text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  insert into public.onboarding (user_id) values (v_uid) on conflict (user_id) do nothing;

  if p_event = 'briefing_seen' then
    update public.onboarding set briefing_seen_at = coalesce(briefing_seen_at, now()), updated_at = now() where user_id = v_uid;
  elsif p_event = 'tour_step' then
    update public.onboarding set tour_step = greatest(0, least(coalesce(nullif(p_value, '')::int, 0), 200)), updated_at = now() where user_id = v_uid;
  elsif p_event = 'tour_done' then
    update public.onboarding set tour_done_at = coalesce(tour_done_at, now()), tour_step = 0, briefing_seen_at = coalesce(briefing_seen_at, now()), updated_at = now() where user_id = v_uid;
  elsif p_event = 'tour_skipped' then
    update public.onboarding set tour_skipped_at = now(), briefing_seen_at = coalesce(briefing_seen_at, now()), updated_at = now() where user_id = v_uid;
  elsif p_event = 'tip_seen' and p_value is not null and length(p_value) <= 40 then
    update public.onboarding
       set tips_seen = case when p_value = any(tips_seen) then tips_seen else (tips_seen || p_value)[greatest(1, cardinality(tips_seen) - 98):] end,
           updated_at = now()
     where user_id = v_uid;
  elsif p_event = 'tips_reset' then
    update public.onboarding set tips_seen = '{}', updated_at = now() where user_id = v_uid;
  else
    return jsonb_build_object('error', 'unknown_event');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- La prime d'intégration : une seule fois, conditions vérifiées ici.
create or replace function public.claim_onboarding_reward()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  o public.onboarding;
  v_done int;
  v_min int := public.get_config_numeric('onboarding_reward_min_steps', 5)::int;
  v_reward numeric := round(public.get_config_numeric('onboarding_reward', 1000), 2);
  v_sandbox timestamptz;
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  select sandbox_expires_at into v_sandbox from public.profiles where id = v_uid;
  if v_sandbox is not null then return jsonb_build_object('error', 'sandbox'); end if;

  insert into public.onboarding (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into o from public.onboarding where user_id = v_uid for update;
  if o.reward_claimed_at is not null then return jsonb_build_object('error', 'already_claimed'); end if;
  if o.tour_done_at is null then return jsonb_build_object('error', 'tour_not_done'); end if;
  select count(*) into v_done from jsonb_each(public._onboarding_steps(v_uid)) where value = 'true'::jsonb;
  if v_done < v_min then return jsonb_build_object('error', 'not_enough_steps', 'done', v_done, 'needed', v_min); end if;

  update public.onboarding set reward_claimed_at = now(), updated_at = now() where user_id = v_uid;
  if v_reward > 0 then
    insert into public.wallets (user_id, balance) values (v_uid, 0) on conflict (user_id) do nothing;
    update public.wallets set balance = balance + v_reward where user_id = v_uid;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (v_uid, v_reward, 'Prime d''intégration', v_uid);
  end if;
  return jsonb_build_object('success', true, 'amount', v_reward);
end;
$$;

revoke execute on function public.get_onboarding() from public, anon;
revoke execute on function public.onboarding_event(text, text) from public, anon;
revoke execute on function public.claim_onboarding_reward() from public, anon;
grant execute on function public.get_onboarding() to authenticated;
grant execute on function public.onboarding_event(text, text) to authenticated;
grant execute on function public.claim_onboarding_reward() to authenticated;
