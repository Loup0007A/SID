-- =========================================================
-- Lot 56 : désactiver les astuces en haut de page.
-- À lancer après 0074 (et donc après 0072). Peut être relancée sans risque.
--
-- Chaque membre peut couper les astuces de première visite (bouton sur
-- l'astuce elle-même, ou menu « ? »), et les rallumer depuis le même menu.
-- Le réglage suit le membre d'un appareil à l'autre.
-- =========================================================

alter table public.onboarding add column if not exists tips_disabled boolean not null default false;

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
    'tips_disabled', o.tips_disabled,
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
    update public.onboarding set tips_seen = '{}', tips_disabled = false, updated_at = now() where user_id = v_uid;
  elsif p_event = 'tips_off' then
    update public.onboarding set tips_disabled = true, updated_at = now() where user_id = v_uid;
  elsif p_event = 'tips_on' then
    update public.onboarding set tips_disabled = false, updated_at = now() where user_id = v_uid;
  else
    return jsonb_build_object('error', 'unknown_event');
  end if;
  return jsonb_build_object('success', true);
end;
$$;
