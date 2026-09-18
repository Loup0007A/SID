-- =========================================================
-- Ajuste le calcul de renommée : le montant en jeu (le "facteur K" du
-- calcul Elo) est désormais mis à l'échelle du niveau moyen de renommée
-- parmi les membres qui en ont déjà (> 0). Plus la renommée en circulation
-- est concentrée/élevée, plus les gains et pertes individuels sont gros —
-- pour qu'un gain de "quelques points" ne devienne pas insignifiant une
-- fois que la communauté a accumulé beaucoup de renommée.
--
-- Exemple donné : si seules 2 personnes ont de la renommée pour un total
-- de 100 000, la renommée moyenne est de 50 000 (soit une cote Elo interne
-- de 51 000 après la base à 1000) — le facteur d'échelle est alors ~51x le
-- facteur K de base (32), donc de l'ordre de 1600 au lieu de 32.
-- =========================================================

-- Facteur d'échelle : 1.0 tant que personne n'a de renommée (comportement
-- Elo classique, K=32), et augmente ensuite avec la renommée moyenne des
-- membres qui en ont.
create or replace function public.get_reputation_scale_factor()
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select greatest(1.0, 1.0 + (coalesce(avg(reputation), 0)::numeric / 1000.0))
  from public.profiles
  where reputation > 0;
$$;

-- compute_reputation_delta accepte maintenant ce facteur d'échelle en
-- paramètre (calculé une fois par les fonctions appelantes ci-dessous,
-- plutôt que requêté à chaque appel).
create or replace function public.compute_reputation_delta(
  p_difficulty text,
  p_current_reputation int,
  p_success boolean,
  p_scale_factor numeric default 1.0
)
returns int
language plpgsql
immutable
as $$
declare
  v_quest_rating int;
  v_player_rating int;
  v_expected numeric;
  v_actual numeric;
  v_k numeric;
begin
  v_quest_rating := case p_difficulty
    when 'E' then 800
    when 'D' then 1000
    when 'C' then 1200
    when 'B' then 1400
    when 'A' then 1600
    when 'S' then 1800
    else 1000
  end;

  v_player_rating := 1000 + coalesce(p_current_reputation, 0);
  v_expected := 1.0 / (1.0 + power(10.0, (v_quest_rating - v_player_rating) / 400.0));
  v_actual := case when p_success then 1.0 else 0.0 end;

  -- Facteur K de base (32, comme les classements Elo classiques), mis à
  -- l'échelle du "poids" de la renommée déjà en circulation.
  v_k := 32.0 * greatest(1.0, p_scale_factor);

  return round(v_k * (v_actual - v_expected))::int;
end;
$$;

-- ---------------------------------------------------------
-- Fonctions appelantes : calculent le facteur d'échelle UNE fois (pas par
-- participant) et le transmettent à compute_reputation_delta.
-- ---------------------------------------------------------

create or replace function public.validate_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_participant public.quest_participants;
  v_recipient uuid;
  v_creator_balance numeric(18,2);
  v_rep_delta int;
  v_current_rep int;
  v_scale numeric;
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  select * into v_quest from public.quests where id = p_quest_id for update;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  select * into v_participant from public.quest_participants
    where quest_id = p_quest_id and user_id = p_user_id;
  if v_participant.user_id is null then
    raise exception 'Participant introuvable';
  end if;

  v_recipient := coalesce(v_participant.reward_recipient_id, p_user_id);

  if v_quest.funded_by_creator and v_quest.created_by is not null then
    select balance into v_creator_balance from public.wallets where user_id = v_quest.created_by for update;
    if v_creator_balance is null or v_creator_balance < v_quest.reward then
      raise exception 'Le créateur de la quête n''a pas les fonds suffisants pour verser cette récompense.';
    end if;
    update public.wallets set balance = balance - v_quest.reward where user_id = v_quest.created_by;
    insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
    values (v_quest.created_by, -v_quest.reward, 'Financement quête : ' || v_quest.title, p_quest_id, auth.uid());
  end if;

  update public.quest_participants
    set status = 'validated'
    where quest_id = p_quest_id and user_id = p_user_id;

  update public.wallets set balance = balance + v_quest.reward where user_id = v_recipient;

  insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
  values (v_recipient, v_quest.reward, 'Récompense quête : ' || v_quest.title, p_quest_id, auth.uid());

  select reputation into v_current_rep from public.profiles where id = p_user_id;
  v_scale := public.get_reputation_scale_factor();
  v_rep_delta := coalesce(v_quest.reputation_reward, public.compute_reputation_delta(v_quest.difficulty, v_current_rep, true, v_scale));
  update public.profiles set reputation = reputation + v_rep_delta where id = p_user_id;
end;
$$;

create or replace function public.do_validate_quest_all_participants(p_quest_id uuid, p_actor uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  r record;
  v_recipient uuid;
  v_count int := 0;
  v_to_validate int;
  v_creator_balance numeric(18,2);
  v_rep_delta int;
  v_current_rep int;
  v_scale numeric;
begin
  select * into v_quest from public.quests where id = p_quest_id for update;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  select count(*) into v_to_validate from public.quest_participants
    where quest_id = p_quest_id and status <> 'validated';

  if v_quest.funded_by_creator and v_quest.created_by is not null and v_to_validate > 0 then
    select balance into v_creator_balance from public.wallets where user_id = v_quest.created_by for update;
    if v_creator_balance is null or v_creator_balance < (v_quest.reward * v_to_validate) then
      raise exception 'Le créateur de la quête n''a pas les fonds suffisants pour verser % récompense(s).', v_to_validate;
    end if;
    update public.wallets set balance = balance - (v_quest.reward * v_to_validate) where user_id = v_quest.created_by;
    insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
    values (v_quest.created_by, -(v_quest.reward * v_to_validate), 'Financement quête : ' || v_quest.title, p_quest_id, p_actor);
  end if;

  v_scale := public.get_reputation_scale_factor();

  for r in
    select * from public.quest_participants
    where quest_id = p_quest_id and status <> 'validated'
  loop
    v_recipient := coalesce(r.reward_recipient_id, r.user_id);

    update public.quest_participants
      set status = 'validated'
      where quest_id = p_quest_id and user_id = r.user_id;

    update public.wallets set balance = balance + v_quest.reward where user_id = v_recipient;

    insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
    values (v_recipient, v_quest.reward, 'Récompense quête : ' || v_quest.title, p_quest_id, p_actor);

    select reputation into v_current_rep from public.profiles where id = r.user_id;
    v_rep_delta := coalesce(v_quest.reputation_reward, public.compute_reputation_delta(v_quest.difficulty, v_current_rep, true, v_scale));
    update public.profiles set reputation = reputation + v_rep_delta where id = r.user_id;

    v_count := v_count + 1;
  end loop;

  update public.quests
    set status = 'completed', pending_expiry_confirmation = false
    where id = p_quest_id;

  return v_count;
end;
$$;

create or replace function public.reject_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_rep_delta int;
  v_current_rep int;
  v_scale numeric;
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  select reputation into v_current_rep from public.profiles where id = p_user_id;
  v_scale := public.get_reputation_scale_factor();
  v_rep_delta := coalesce(-v_quest.reputation_reward, public.compute_reputation_delta(v_quest.difficulty, v_current_rep, false, v_scale));

  update public.profiles set reputation = reputation + v_rep_delta where id = p_user_id;
  update public.quest_participants set status = 'rejected' where quest_id = p_quest_id and user_id = p_user_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    p_user_id, 'quest_failed', 'Quête échouée',
    '"' || v_quest.title || '" a été marquée comme échouée pour toi (' || v_rep_delta || ' de renommée).',
    '/dashboard/quests'
  );
end;
$$;

create or replace function public.apply_quest_failure_penalties()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_rep_delta int;
  v_current_rep int;
  v_scale numeric;
begin
  if new.status = 'failed' and old.status is distinct from 'failed' then
    v_scale := public.get_reputation_scale_factor();

    for r in
      select * from public.quest_participants
      where quest_id = new.id and status not in ('validated', 'rejected')
    loop
      select reputation into v_current_rep from public.profiles where id = r.user_id;
      v_rep_delta := coalesce(-new.reputation_reward, public.compute_reputation_delta(new.difficulty, v_current_rep, false, v_scale));

      update public.profiles set reputation = reputation + v_rep_delta where id = r.user_id;
      update public.quest_participants set status = 'rejected' where quest_id = new.id and user_id = r.user_id;

      insert into public.notifications (user_id, type, title, body, link)
      values (
        r.user_id, 'quest_failed', 'Quête échouée',
        '"' || new.title || '" a échoué (' || v_rep_delta || ' de renommée).',
        '/dashboard/quests'
      );
    end loop;
  end if;
  return new;
end;
$$;
