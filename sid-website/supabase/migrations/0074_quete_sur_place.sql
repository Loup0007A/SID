-- =========================================================
-- Lot 55 : une quête liée à un lieu ne se prend que sur place.
-- À lancer après 0073. Peut être relancée sans risque.
--
-- Pour s'inscrire à une quête qui a un lieu (quests.place_id), il faut
-- que son personnage soit à ce lieu, arrivé (pas en plein trajet ni en
-- vol). Les quêtes sans lieu se prennent de partout, comme avant.
-- Un responsable des quêtes qui inscrit quelqu'un d'autre passe outre,
-- comme pour les autres prérequis.
-- =========================================================

create or replace function public.check_quest_prerequisites()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_q public.quests;
  v_s public.member_stats;
  v_power numeric;
  v_missing text[] := '{}';
  v_here uuid;
  v_moving boolean;
  v_place text;
begin
  -- Un responsable des quêtes qui inscrit quelqu'un d'autre passe outre.
  if new.user_id <> auth.uid() and public.has_permission(auth.uid(), 'manage_quests') then
    return new;
  end if;

  select * into v_q from public.quests where id = new.quest_id;
  if v_q.id is null then
    return new;
  end if;

  -- Être sur le lieu de la quête.
  if v_q.place_id is not null and to_regclass('public.character_positions') is not null then
    execute 'select place_id, (travel_started_at is not null or flight_target_place_id is not null) from public.character_positions where user_id = $1'
      into v_here, v_moving using new.user_id;
    if v_here is distinct from v_q.place_id or coalesce(v_moving, false) then
      begin
        execute 'select name from public.map_places where id = $1' into v_place using v_q.place_id;
      exception when others then v_place := null;
      end;
      raise exception 'Cette quête se prend sur place : rends-toi d''abord à %.', coalesce(v_place, 'son lieu');
    end if;
  end if;

  select * into v_s from public.member_stats where user_id = new.user_id;
  select power_score into v_power from public.profiles where id = new.user_id;

  if coalesce(v_s.intelligence, 0) < v_q.min_intelligence then
    v_missing := v_missing || format('Intelligence %s (tu as %s)', trim_scale(v_q.min_intelligence), trim_scale(coalesce(v_s.intelligence, 0)));
  end if;
  if coalesce(v_s.strength, 0) < v_q.min_strength then
    v_missing := v_missing || format('Puissance %s (tu as %s)', trim_scale(v_q.min_strength), trim_scale(coalesce(v_s.strength, 0)));
  end if;
  if coalesce(v_s.technique, 0) < v_q.min_technique then
    v_missing := v_missing || format('Technique %s (tu as %s)', trim_scale(v_q.min_technique), trim_scale(coalesce(v_s.technique, 0)));
  end if;
  if coalesce(v_power, 0) < v_q.min_power then
    v_missing := v_missing || format('Puissance globale %s (tu as %s)', trim_scale(v_q.min_power), trim_scale(coalesce(v_power, 0)));
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'Prérequis non atteints : %.', array_to_string(v_missing, ', ');
  end if;
  return new;
end;
$$;
