-- =========================================================
-- Gain (ou perte) de renommée lié aux quêtes.
--
-- Deux modes, au choix du créateur de la quête :
-- - `reputation_reward` renseigné (int) : montant fixe, identique pour
--   tout le monde. Gagné en cas de réussite, PERDU (même montant) en cas
--   d'échec.
-- - `reputation_reward` = null (par défaut) : calcul automatique façon
--   Elo, à partir du rang de la quête (E à S, mappé sur une "cote" comme un
--   classement d'échecs) et de la renommée actuelle du membre. Réussir une
--   quête au-dessus de son niveau rapporte gros ; réussir une quête
--   largement en dessous de son niveau rapporte peu ; échouer une quête
--   "facile" pour son niveau coûte cher, échouer une quête très difficile
--   coûte peu. C'est la même logique que les classements Elo aux échecs.
-- =========================================================

alter table public.quests add column reputation_reward int;

comment on column public.quests.reputation_reward is
  'Gain de renommée fixe (perdu en cas d''échec). NULL = calcul automatique façon Elo selon le rang de la quête et la renommée actuelle du participant.';

-- Cote Elo associée à chaque rang de quête (E à S), et calcul du delta.
create or replace function public.compute_reputation_delta(p_difficulty text, p_current_reputation int, p_success boolean)
returns int
language plpgsql
immutable
as $$
declare
  v_quest_rating int;
  v_player_rating int;
  v_expected numeric;
  v_actual numeric;
  v_k constant numeric := 32; -- même "facteur K" que les classements Elo classiques
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

  -- La renommée affichée part de 0 (plus lisible côté joueur), mais le
  -- calcul Elo utilise en interne une base à 1000 (convention habituelle).
  v_player_rating := 1000 + coalesce(p_current_reputation, 0);

  v_expected := 1.0 / (1.0 + power(10.0, (v_quest_rating - v_player_rating) / 400.0));
  v_actual := case when p_success then 1.0 else 0.0 end;

  return round(v_k * (v_actual - v_expected))::int;
end;
$$;

-- ---------------------------------------------------------
-- Validation (réussite) : on ajoute le gain de renommée du PARTICIPANT qui
-- a fait la quête (pas forcément le bénéficiaire de la récompense en
-- argent, qui peut être quelqu'un d'autre — voir reward_recipient_id).
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
  v_rep_delta := coalesce(v_quest.reputation_reward, public.compute_reputation_delta(v_quest.difficulty, v_current_rep, true));
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
    v_rep_delta := coalesce(v_quest.reputation_reward, public.compute_reputation_delta(v_quest.difficulty, v_current_rep, true));
    update public.profiles set reputation = reputation + v_rep_delta where id = r.user_id;

    v_count := v_count + 1;
  end loop;

  update public.quests
    set status = 'completed', pending_expiry_confirmation = false
    where id = p_quest_id;

  return v_count;
end;
$$;

-- ---------------------------------------------------------
-- Échec : rejet manuel d'un participant précis par un manager.
-- ---------------------------------------------------------

create or replace function public.reject_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_rep_delta int;
  v_current_rep int;
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  select reputation into v_current_rep from public.profiles where id = p_user_id;
  v_rep_delta := coalesce(-v_quest.reputation_reward, public.compute_reputation_delta(v_quest.difficulty, v_current_rep, false));

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

-- ---------------------------------------------------------
-- Échec automatique : quand une quête entière passe au statut "failed"
-- (expiration sans objectif atteint, ou décision du créateur), tous les
-- participants pas encore validés perdent de la renommée et sont marqués
-- "rejected".
-- ---------------------------------------------------------

-- Autorise le nouveau type de notification "quête échouée" (symétrique à
-- "quête validée", déjà existante).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision',
  'quest_confirmation_needed', 'travel_arrived', 'salary_paid'
));

create or replace function public.apply_quest_failure_penalties()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_rep_delta int;
  v_current_rep int;
begin
  if new.status = 'failed' and old.status is distinct from 'failed' then
    for r in
      select * from public.quest_participants
      where quest_id = new.id and status not in ('validated', 'rejected')
    loop
      select reputation into v_current_rep from public.profiles where id = r.user_id;
      v_rep_delta := coalesce(-new.reputation_reward, public.compute_reputation_delta(new.difficulty, v_current_rep, false));

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

drop trigger if exists trg_quest_failure_penalties on public.quests;
create trigger trg_quest_failure_penalties
  after update on public.quests
  for each row execute function public.apply_quest_failure_penalties();
