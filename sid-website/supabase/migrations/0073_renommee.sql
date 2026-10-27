-- =========================================================
-- Lot 54 : la renommée, réparée de bout en bout.
-- À lancer après 0072 (et après les migrations de la Cartographie).
-- Peut être relancée sans risque.
--
-- Ce qui n'allait pas :
--   1. Présence sur le lieu d'une quête (1 h, Cartographie) : la
--      validation demandait la permission « gestion des quêtes » au membre
--      lui-même, donc échouait toujours en silence. Ni récompense ni
--      renommée.
--   2. Valider deux fois le même participant payait et donnait la
--      renommée deux fois ; le rejeter deux fois la retirait deux fois ;
--      rejeter quelqu'un déjà validé lui retirait de la renommée en plus
--      de ce qu'il avait gagné.
--   3. « Valider tout le monde » (et la validation automatique à
--      l'échéance) validait aussi les participants déjà rejetés : payés
--      et récompensés après avoir été sanctionnés.
--   4. Les quêtes sans limite de places n'expiraient jamais : ni réussite
--      ni échec, la renommée restait bloquée. Et les participants rejetés
--      comptaient pour atteindre l'objectif.
--   5. Rien ne montrait au membre ce qu'il gagnait ou perdait : la
--      notification ne donnait pas le montant, aucune trace, aucun aperçu.
--   6. Le calcul façon Elo pouvait arrondir à 0 : une quête réussie
--      pouvait ne rien rapporter.
--
-- Ce qui change :
--   * Chaque mouvement de renommée passe par un seul endroit et laisse une
--     trace (table reputation_events) : quête réussie, échouée, présence,
--     correction de l'administration.
--   * Un participant ne peut être validé ou rejeté qu'une fois. Valider
--     quelqu'un qui avait été rejeté annule d'abord sa sanction.
--   * Réussir rapporte toujours au moins 1, échouer coûte au moins 1
--     (calcul automatique).
--   * Quête sans limite de places arrivée à échéance : son créateur
--     décide (valider / échouer) s'il y a des participants ; sinon elle
--     échoue (personne n'est pénalisé).
--   * Notifications avec le montant ; aperçu « +X si réussie, −Y si
--     échouée » sur chaque quête ; historique dans Mon dossier.
-- =========================================================

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason text not null,
  quest_id uuid references public.quests(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.reputation_events alter column created_at set default clock_timestamp();
create index if not exists reputation_events_user_idx on public.reputation_events (user_id, created_at desc);
create index if not exists reputation_events_quest_idx on public.reputation_events (quest_id, user_id);

alter table public.reputation_events enable row level security;
drop policy if exists reputation_events_read on public.reputation_events;
create policy reputation_events_read on public.reputation_events for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users') or public.has_permission(auth.uid(), 'manage_economy'));

-- ---------------------------------------------------------
-- Le seul endroit qui change la renommée.
-- ---------------------------------------------------------
create or replace function public._add_reputation(p_user uuid, p_delta int, p_reason text, p_quest uuid default null, p_actor uuid default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user is null or coalesce(p_delta, 0) = 0 then return; end if;
  update public.profiles set reputation = coalesce(reputation, 0) + p_delta where id = p_user;
  insert into public.reputation_events (user_id, delta, reason, quest_id, actor_id)
  values (p_user, p_delta, p_reason, p_quest, p_actor);
end;
$$;

-- Gain (ou perte) pour un membre et une quête. Calcul automatique : au
-- moins +1 en cas de réussite, au moins −1 en cas d'échec.
create or replace function public._quest_rep_delta(p_quest public.quests, p_user uuid, p_success boolean, p_scale numeric default null)
returns int
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_rep int;
  v int;
begin
  if p_quest.reputation_reward is not null then
    return case when p_success then p_quest.reputation_reward else -p_quest.reputation_reward end;
  end if;
  select coalesce(reputation, 0) into v_rep from public.profiles where id = p_user;
  v := public.compute_reputation_delta(p_quest.difficulty::text, v_rep, p_success, coalesce(p_scale, public.get_reputation_scale_factor()));
  if p_success then return greatest(1, v); end if;
  return least(-1, v);
end;
$$;

revoke execute on function public._add_reputation(uuid, int, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._quest_rep_delta(public.quests, uuid, boolean, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------
-- Validation d'un participant (sans contrôle de permission : réservé aux
-- fonctions ci-dessous). Renvoie la renommée gagnée, ou null si le
-- participant était déjà validé.
-- ---------------------------------------------------------
create or replace function public._validate_quest_participant(p_quest_id uuid, p_user_id uuid, p_actor uuid, p_reason text default 'Quête réussie')
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_part public.quest_participants;
  v_recipient uuid;
  v_balance numeric(18,2);
  v_delta int;
  v_undo int;
begin
  select * into v_quest from public.quests where id = p_quest_id for update;
  if v_quest.id is null then raise exception 'Quête introuvable'; end if;

  select * into v_part from public.quest_participants where quest_id = p_quest_id and user_id = p_user_id for update;
  if v_part.user_id is null then raise exception 'Participant introuvable'; end if;
  if v_part.status = 'validated' then return null; end if;

  v_recipient := coalesce(v_part.reward_recipient_id, p_user_id);

  if v_quest.funded_by_creator and v_quest.created_by is not null and coalesce(v_quest.reward, 0) > 0 then
    select balance into v_balance from public.wallets where user_id = v_quest.created_by for update;
    if v_balance is null or v_balance < v_quest.reward then
      raise exception 'Le créateur de la quête n''a pas les fonds suffisants pour verser cette récompense.';
    end if;
    update public.wallets set balance = balance - v_quest.reward where user_id = v_quest.created_by;
    insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
    values (v_quest.created_by, -v_quest.reward, 'Financement quête : ' || v_quest.title, p_quest_id, p_actor);
  end if;

  if coalesce(v_quest.reward, 0) > 0 then
    update public.wallets set balance = balance + v_quest.reward where user_id = v_recipient;
    insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
    values (v_recipient, v_quest.reward, 'Récompense quête : ' || v_quest.title, p_quest_id, p_actor);
  end if;

  -- Il avait été rejeté : on annule d'abord la sanction.
  if v_part.status = 'rejected' then
    select coalesce(sum(delta), 0) into v_undo from public.reputation_events
      where user_id = p_user_id and quest_id = p_quest_id and delta < 0;
    if v_undo < 0 then
      perform public._add_reputation(p_user_id, -v_undo, 'Sanction annulée : ' || v_quest.title, p_quest_id, p_actor);
    end if;
  end if;

  v_delta := public._quest_rep_delta(v_quest, p_user_id, true);
  perform public._add_reputation(p_user_id, v_delta, p_reason || ' : ' || v_quest.title, p_quest_id, p_actor);

  -- En dernier : la notification (déclencheur) lit le montant ci-dessus.
  update public.quest_participants set status = 'validated' where quest_id = p_quest_id and user_id = p_user_id;
  return v_delta;
end;
$$;

revoke execute on function public._validate_quest_participant(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public._can_manage_quest(p_quest_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.has_permission(auth.uid(), 'manage_quests')
      or exists (select 1 from public.quests where id = p_quest_id and created_by = auth.uid());
$$;

create or replace function public.validate_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v int;
begin
  if not public._can_manage_quest(p_quest_id) then raise exception 'Permission refusée'; end if;
  v := public._validate_quest_participant(p_quest_id, p_user_id, auth.uid());
  if v is null then raise exception 'Ce participant est déjà validé.'; end if;
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
  v_todo int;
  v_balance numeric(18,2);
  v_count int := 0;
begin
  select * into v_quest from public.quests where id = p_quest_id for update;
  if v_quest.id is null then raise exception 'Quête introuvable'; end if;

  -- Les participants rejetés restent rejetés.
  select count(*) into v_todo from public.quest_participants
    where quest_id = p_quest_id and status not in ('validated', 'rejected');

  if v_quest.funded_by_creator and v_quest.created_by is not null and v_todo > 0 and coalesce(v_quest.reward, 0) > 0 then
    select balance into v_balance from public.wallets where user_id = v_quest.created_by;
    if v_balance is null or v_balance < v_quest.reward * v_todo then
      raise exception 'Le créateur de la quête n''a pas les fonds suffisants pour verser % récompense(s).', v_todo;
    end if;
  end if;

  for r in
    select user_id from public.quest_participants
    where quest_id = p_quest_id and status not in ('validated', 'rejected')
  loop
    if public._validate_quest_participant(p_quest_id, r.user_id, p_actor) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  update public.quests set status = 'completed', pending_expiry_confirmation = false where id = p_quest_id;
  return v_count;
end;
$$;

create or replace function public.validate_quest_all_participants(p_quest_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
begin
  if not public._can_manage_quest(p_quest_id) then raise exception 'Permission refusée'; end if;
  return public.do_validate_quest_all_participants(p_quest_id, auth.uid());
end;
$$;

create or replace function public.reject_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_part public.quest_participants;
  v_delta int;
begin
  if not public._can_manage_quest(p_quest_id) then raise exception 'Permission refusée'; end if;

  select * into v_quest from public.quests where id = p_quest_id for update;
  if v_quest.id is null then raise exception 'Quête introuvable'; end if;
  select * into v_part from public.quest_participants where quest_id = p_quest_id and user_id = p_user_id for update;
  if v_part.user_id is null then raise exception 'Participant introuvable'; end if;
  if v_part.status = 'validated' then raise exception 'Ce participant est déjà validé (et payé) : il ne peut plus échouer.'; end if;
  if v_part.status = 'rejected' then raise exception 'Ce participant a déjà échoué.'; end if;

  v_delta := public._quest_rep_delta(v_quest, p_user_id, false);
  perform public._add_reputation(p_user_id, v_delta, 'Quête échouée : ' || v_quest.title, p_quest_id, auth.uid());
  update public.quest_participants set status = 'rejected' where quest_id = p_quest_id and user_id = p_user_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, 'quest_failed', 'Quête échouée',
          '"' || v_quest.title || '" a été marquée comme échouée pour toi (' || v_delta || ' de renommée).', '/dashboard/quests');
end;
$$;

-- Échec de toute la quête : les participants pas encore validés ni
-- rejetés perdent de la renommée.
create or replace function public.apply_quest_failure_penalties()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_delta int;
  v_scale numeric;
begin
  if new.status = 'failed' and old.status is distinct from 'failed' then
    v_scale := public.get_reputation_scale_factor();
    for r in
      select user_id from public.quest_participants
      where quest_id = new.id and status not in ('validated', 'rejected')
    loop
      v_delta := public._quest_rep_delta(new, r.user_id, false, v_scale);
      perform public._add_reputation(r.user_id, v_delta, 'Quête échouée : ' || new.title, new.id, null);
      update public.quest_participants set status = 'rejected' where quest_id = new.id and user_id = r.user_id;
      insert into public.notifications (user_id, type, title, body, link)
      values (r.user_id, 'quest_failed', 'Quête échouée', '"' || new.title || '" a échoué (' || v_delta || ' de renommée).', '/dashboard/quests');
    end loop;
  end if;
  return new;
end;
$$;

-- Notification de réussite, avec le montant.
create or replace function public.notify_quest_validated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_title text;
  v_reward numeric;
  v_delta int;
begin
  if new.status = 'validated' and old.status is distinct from 'validated' then
    select title, reward into v_title, v_reward from public.quests where id = new.quest_id;
    select delta into v_delta from public.reputation_events
      where user_id = new.user_id and quest_id = new.quest_id and delta > 0
      order by created_at desc limit 1;
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.user_id, 'quest_validated', 'Quête validée',
      '"' || coalesce(v_title, 'Une quête') || '" a été validée'
        || case when coalesce(v_reward, 0) > 0 then ' : récompense versée' else '' end
        || case when v_delta is not null then ', +' || v_delta || ' de renommée.' else '.' end,
      '/dashboard/quests'
    );
  end if;
  return new;
end;
$$;

-- Échéances : les participants rejetés ne comptent pas ; les quêtes sans
-- limite de places expirent aussi.
create or replace function public.process_expired_quests()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_margin constant int := 1;
  r record;
  v_count int;
  v_processed int := 0;
begin
  for r in
    select * from public.quests
    where deadline is not null
      and deadline <= now()
      and status in ('open', 'in_progress')
      and not pending_expiry_confirmation
    for update skip locked
  loop
    select count(*) into v_count from public.quest_participants where quest_id = r.id and status <> 'rejected';

    if r.max_participants is null then
      if v_count > 0 then
        update public.quests set pending_expiry_confirmation = true where id = r.id;
      else
        update public.quests set status = 'failed' where id = r.id;
      end if;
    elsif v_count >= r.max_participants then
      perform public.do_validate_quest_all_participants(r.id, r.created_by);
    elsif v_count >= (r.max_participants - v_margin) and v_count > 0 then
      update public.quests set pending_expiry_confirmation = true where id = r.id;
    else
      update public.quests set status = 'failed' where id = r.id;
    end if;

    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

-- Corrections de l'administration : elles laissent aussi une trace.
create or replace function public.adjust_reputation(p_user_id uuid, p_amount integer, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not (public.has_permission(auth.uid(), 'manage_economy') or public.has_permission(auth.uid(), 'manage_users')) then
    raise exception 'Permission refusée';
  end if;
  perform public._add_reputation(p_user_id, p_amount, coalesce(nullif(trim(p_reason), ''), 'Correction de l''administration'), null, auth.uid());
  perform public.write_audit('reputation_adjusted', p_user_id, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end;
$$;

-- ---------------------------------------------------------
-- Présence sur le lieu d'une quête (Cartographie) : 1 h sur place
-- valide la participation, récompense et renommée comprises.
-- ---------------------------------------------------------
do $$
begin
  if to_regclass('public.character_positions') is not null and to_regprocedure('public.quest_is_finished(text)') is not null then
    execute $f$
      create or replace function public.check_quest_arrival()
      returns jsonb
      language plpgsql security definer set search_path = public
      as $body$
      declare
        v_pos record;
        v_quest record;
        v_delta int;
        v_result jsonb := '[]'::jsonb;
      begin
        select * into v_pos from public.character_positions where user_id = auth.uid();
        if not found or v_pos.place_id is null or v_pos.arrived_at is null or v_pos.travel_started_at is not null then
          return v_result;
        end if;
        if now() - v_pos.arrived_at < interval '60 minutes' then
          return v_result;
        end if;

        for v_quest in
          select q.id
          from public.quests q
          join public.quest_participants qp on qp.quest_id = q.id and qp.user_id = auth.uid()
          where q.place_id = v_pos.place_id
            and not public.quest_is_finished(q.status::text)
            and qp.status not in ('validated', 'rejected')
        loop
          begin
            v_delta := public._validate_quest_participant(v_quest.id, auth.uid(), auth.uid(), 'Présence confirmée');
            if v_delta is not null then
              v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', true, 'reputation', v_delta);
            end if;
          exception when others then
            v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', false, 'error', sqlerrm);
          end;
        end loop;
        return v_result;
      end;
      $body$
    $f$;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- Ce que le membre voit.
-- ---------------------------------------------------------
-- Aperçu pour chaque quête en cours : ce que je gagne si elle réussit,
-- ce que je perds si elle échoue.
create or replace function public.quest_reputation_preview()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_scale numeric := public.get_reputation_scale_factor();
  v jsonb := '{}'::jsonb;
  q public.quests;
  v_status text;
begin
  if v_uid is null then return v; end if;
  for q in select * from public.quests where status in ('open', 'in_progress') loop
    select status into v_status from public.quest_participants where quest_id = q.id and user_id = v_uid;
    if v_status in ('validated', 'rejected') then
      -- Déjà jouée pour moi : le résultat réel, sanction annulée comprise.
      v := v || jsonb_build_object(q.id::text, jsonb_build_object(
        'status', v_status,
        'delta', coalesce((select sum(delta) from public.reputation_events where user_id = v_uid and quest_id = q.id), 0)));
    else
      v := v || jsonb_build_object(q.id::text, jsonb_build_object(
        'gain', public._quest_rep_delta(q, v_uid, true, v_scale),
        'loss', public._quest_rep_delta(q, v_uid, false, v_scale)));
    end if;
  end loop;
  return v;
end;
$$;

-- Ma renommée, mon rang au classement et mon historique.
create or replace function public.get_my_reputation()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rep int;
begin
  if v_uid is null then return null; end if;
  select coalesce(reputation, 0) into v_rep from public.profiles where id = v_uid;
  return jsonb_build_object(
    'reputation', v_rep,
    'position', (select count(*) + 1 from public.profiles p
                 where p.status = 'active' and coalesce(p.reputation, 0) > v_rep
                   and (not p.is_invisible or public.can_see_invisible(p.id))),
    'members', (select count(*) from public.profiles p where p.status = 'active' and (not p.is_invisible or public.can_see_invisible(p.id))),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('delta', e.delta, 'reason', e.reason, 'at', e.created_at) order by e.created_at desc)
      from (select * from public.reputation_events where user_id = v_uid order by created_at desc limit 20) e
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public._can_manage_quest(uuid) from public, anon;
grant execute on function public.quest_reputation_preview() to authenticated;
grant execute on function public.get_my_reputation() to authenticated;
