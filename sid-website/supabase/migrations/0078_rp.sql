-- =====================================================================
-- 0078 — Jeu de rôle : messagerie RP, ordres de mission, rapports,
--        Chroniques du S.I.D. (+ correctif de sécurité des participations)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Correctif : un participant ne peut plus modifier sa participation
-- ---------------------------------------------------------------------
-- La règle d'accès laissait un membre modifier sa propre ligne : il
-- pouvait se marquer « validé » lui-même, ou déplacer sa participation vers
-- une autre quête (contournant la prise « sur place » et la limite de
-- places). Seuls les responsables (et les fonctions internes) changent
-- désormais le statut, la quête ou le membre. Le membre peut toujours
-- choisir à qui reverser sa récompense.
create or replace function public.guard_quest_participant_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Appels internes (fonctions du site) : elles font leurs propres contrôles.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.has_permission(auth.uid(), 'manage_quests') or public._can_manage_quest(old.quest_id) then
    return new;
  end if;
  if new.quest_id is distinct from old.quest_id
     or new.user_id is distinct from old.user_id
     or new.status is distinct from old.status
     or new.joined_at is distinct from old.joined_at
     or new.report is distinct from old.report
     or new.report_at is distinct from old.report_at then
    raise exception 'Seul un responsable de la quête peut modifier cette participation.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Ordres de mission : commanditaire et objectifs
-- ---------------------------------------------------------------------
alter table public.quests add column if not exists giver text;
alter table public.quests add column if not exists objectives text[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quests_giver_len') then
    alter table public.quests add constraint quests_giver_len check (giver is null or char_length(giver) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quests_objectives_len') then
    alter table public.quests add constraint quests_objectives_len check (cardinality(objectives) <= 8);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Rapports de mission
-- ---------------------------------------------------------------------
alter table public.quest_participants add column if not exists report text;
alter table public.quest_participants add column if not exists report_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quest_participants_report_len') then
    alter table public.quest_participants add constraint quest_participants_report_len check (report is null or char_length(report) <= 4000);
  end if;
end;
$$;

drop trigger if exists trg_guard_quest_participant_update on public.quest_participants;
create trigger trg_guard_quest_participant_update
  before update on public.quest_participants
  for each row execute function public.guard_quest_participant_update();

-- Nouveau type de notification « quest_report » (ajouté à la liste existante,
-- quelle qu'elle soit).
do $$
declare
  v_def text;
  v_types text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null or v_def like '%quest_report%' then return; end if;
  select array_agg(m[1]) into v_types from regexp_matches(v_def, '''([a-z_]+)''', 'g') as m;
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))',
                 array_append(v_types, 'quest_report'));
end;
$$;

-- Rédiger (ou corriger) son rapport : la participation passe « rendue » et
-- le commanditaire est prévenu.
create or replace function public.submit_quest_report(p_quest_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := btrim(coalesce(p_text, ''));
  v_part public.quest_participants;
  v_quest public.quests;
  v_nick text;
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  select * into v_part from public.quest_participants where quest_id = p_quest_id and user_id = v_uid;
  if v_part.quest_id is null then return jsonb_build_object('error', 'not_participant'); end if;
  if v_part.status = 'rejected' then return jsonb_build_object('error', 'rejected'); end if;
  if char_length(v_text) < 20 then return jsonb_build_object('error', 'too_short'); end if;
  if char_length(v_text) > 4000 then return jsonb_build_object('error', 'too_long'); end if;

  update public.quest_participants
     set report = v_text,
         report_at = now(),
         status = case when status = 'assigned' then 'submitted' else status end
   where quest_id = p_quest_id and user_id = v_uid;

  select * into v_quest from public.quests where id = p_quest_id;
  select nickname into v_nick from public.profiles where id = v_uid;
  if v_quest.created_by is not null and v_quest.created_by <> v_uid and v_part.report is null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_quest.created_by, 'quest_report', 'Rapport de mission reçu',
            coalesce(v_nick, 'Un agent') || ' a rendu son rapport : « ' || v_quest.title || ' ».',
            '/dashboard/quests?quete=' || p_quest_id);
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- Les rapports d'une quête : lisibles par ses participants et ses responsables.
create or replace function public.list_quest_reports(p_quest_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return '[]'::jsonb; end if;
  if not (public._can_manage_quest(p_quest_id)
          or exists (select 1 from public.quest_participants where quest_id = p_quest_id and user_id = v_uid)) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', qp.user_id, 'nickname', p.nickname, 'status', qp.status,
             'report', qp.report, 'report_at', qp.report_at)
           order by qp.report_at nulls last)
      from public.quest_participants qp
      join public.profiles p on p.id = qp.user_id
     where qp.quest_id = p_quest_id
  ), '[]'::jsonb);
end;
$$;

-- Les Chroniques du S.I.D. : missions accomplies et leurs rapports validés.
create or replace function public.list_chronicles(p_limit int default 20)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(c order by c->>'at' desc)
    from (
      select jsonb_build_object(
               'id', q.id, 'title', q.title, 'giver', q.giver, 'difficulty', q.difficulty,
               'contract_type', q.contract_type, 'place', mp.name,
               'at', max(qp.report_at),
               'reports', jsonb_agg(jsonb_build_object('nickname', p.nickname, 'report', qp.report, 'at', qp.report_at)
                                    order by qp.report_at)) as c
        from public.quests q
        join public.quest_participants qp on qp.quest_id = q.id
                                         and qp.status = 'validated' and qp.report is not null
        join public.profiles p on p.id = qp.user_id
        left join public.map_places mp on mp.id = q.place_id
       where q.status = 'completed' and q.visibility <> 'private'
       group by q.id, mp.name
       order by max(qp.report_at) desc
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) s
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Messagerie RP : actions, hors-RP, narration, dés
-- ---------------------------------------------------------------------
alter table public.chat_messages add column if not exists kind text not null default 'say';
alter table public.chat_messages add column if not exists meta jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_kind_check') then
    alter table public.chat_messages add constraint chat_messages_kind_check
      check (kind in ('say', 'action', 'hrp', 'narration', 'roll'));
  end if;
end;
$$;

-- Un lancer de dés ne vient que du serveur et ne se modifie pas ; la
-- narration est réservée aux maîtres du jeu (responsables des quêtes, admins).
create or replace function public.guard_chat_kind()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind = 'roll' then
      raise exception 'Les dés se lancent avec /des (ex. /des 1d20).';
    end if;
    if new.kind = 'narration'
       and not (public.has_permission(auth.uid(), 'manage_quests') or public.has_permission(auth.uid(), 'manage_users')) then
      raise exception 'La narration est réservée aux maîtres du jeu.';
    end if;
    new.meta := null;
  else
    if new.kind is distinct from old.kind or new.meta is distinct from old.meta then
      raise exception 'Le type d''un message ne se modifie pas.';
    end if;
    if old.kind = 'roll' and new.content is distinct from old.content then
      raise exception 'Un lancer de dés ne se modifie pas.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_chat_kind on public.chat_messages;
create trigger trg_guard_chat_kind
  before insert or update on public.chat_messages
  for each row execute function public.guard_chat_kind();

-- Lancer des dés dans une conversation : « 1d20 », « 2d6+1 », « d100 », « 3d8-2 ».
create or replace function public.rp_roll(p_channel_id uuid, p_expr text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_expr text := lower(replace(coalesce(p_expr, ''), ' ', ''));
  m text[];
  n int;
  faces int;
  modif int;
  rolls int[] := '{}';
  total int := 0;
  i int;
  v_meta jsonb;
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  if not public.is_channel_participant(p_channel_id, v_uid) then return jsonb_build_object('error', 'forbidden'); end if;
  if coalesce((select is_muted or is_frozen from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'muted');
  end if;
  if not public.is_feature_enabled('chat') then return jsonb_build_object('error', 'disabled'); end if;

  if v_expr = '' then v_expr := '1d20'; end if;
  m := regexp_match(v_expr, '^([0-9]{0,2})d([0-9]{1,4}|%)([+-][0-9]{1,3})?$');
  if m is null then return jsonb_build_object('error', 'invalid'); end if;
  n := coalesce(nullif(m[1], '')::int, 1);
  faces := case when m[2] = '%' then 100 else m[2]::int end;
  modif := coalesce(m[3]::int, 0);
  if n < 1 or n > 20 or faces < 2 or faces > 1000 then return jsonb_build_object('error', 'limits'); end if;

  for i in 1..n loop
    rolls := rolls || (floor(random() * faces)::int + 1);
  end loop;
  select sum(x) into total from unnest(rolls) x;
  total := total + modif;

  v_meta := jsonb_build_object('expr', n || 'd' || faces || case when modif > 0 then '+' || modif when modif < 0 then modif::text else '' end,
                               'rolls', to_jsonb(rolls), 'mod', modif, 'faces', faces, 'total', total);
  insert into public.chat_messages (channel_id, sender_id, content, kind, meta)
  values (p_channel_id, v_uid,
          (v_meta->>'expr') || ' → ' || array_to_string(rolls, ', ')
            || case when modif <> 0 or n > 1 then ' = ' || total else '' end,
          'roll', v_meta);
  return jsonb_build_object('success', true) || v_meta;
end;
$$;

revoke execute on function public.submit_quest_report(uuid, text) from public, anon;
revoke execute on function public.list_quest_reports(uuid) from public, anon;
revoke execute on function public.list_chronicles(int) from public, anon;
revoke execute on function public.rp_roll(uuid, text) from public, anon;
grant execute on function public.submit_quest_report(uuid, text) to authenticated;
grant execute on function public.list_quest_reports(uuid) to authenticated;
grant execute on function public.list_chronicles(int) to authenticated;
grant execute on function public.rp_roll(uuid, text) to authenticated;
