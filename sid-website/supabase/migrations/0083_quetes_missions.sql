-- =====================================================================
-- Lot 68 : missions d'une quête cochées au fur et à mesure, rapport en
-- plusieurs parties (une par mission, plus un bilan). Rejouable.
--
-- Chaque participant coche les missions (objectifs) de sa quête quand il
-- les a menées. Son rapport a une partie par mission et un bilan ; la
-- colonne `report` garde le texte complet, avec un titre par mission, pour
-- ce qui lit le rapport d'un bloc (notification, anciennes pages).
-- =====================================================================

alter table public.quest_participants add column if not exists objectives_done boolean[] not null default '{}';
alter table public.quest_participants add column if not exists report_parts text[] not null default '{}';
alter table public.quest_participants add column if not exists report_summary text;

-- Le texte complet peut maintenant contenir huit parties.
alter table public.quest_participants drop constraint if exists quest_participants_report_len;
alter table public.quest_participants add constraint quest_participants_report_len
  check (report is null or char_length(report) <= 16000);

-- Le membre ne modifie toujours pas sa participation directement (0078) :
-- missions cochées et parties du rapport passent par les fonctions.
create or replace function public.guard_quest_participant_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
     or new.report_at is distinct from old.report_at
     or new.objectives_done is distinct from old.objectives_done
     or new.report_parts is distinct from old.report_parts
     or new.report_summary is distinct from old.report_summary then
    raise exception 'Seul un responsable de la quête peut modifier cette participation.';
  end if;
  return new;
end;
$$;

-- Cocher (ou décocher) une mission. p_index commence à 0.
create or replace function public.quest_objective_set(p_quest_id uuid, p_index int, p_done boolean)
returns boolean[]
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_part public.quest_participants;
  v_quest public.quests;
  v_n int;
  v_done boolean[];
  i int;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select * into v_part from public.quest_participants where quest_id = p_quest_id and user_id = v_uid for update;
  if v_part.quest_id is null then raise exception 'Tu ne participes pas à cette quête.'; end if;
  if v_part.status = 'rejected' then raise exception 'Ta participation a été rejetée.'; end if;
  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.status not in ('open', 'in_progress') then raise exception 'Cette quête est terminée.'; end if;
  v_n := coalesce(cardinality(v_quest.objectives), 0);
  if p_index is null or p_index < 0 or p_index >= v_n then raise exception 'Mission inconnue.'; end if;

  -- Une case par mission (la liste a pu changer depuis).
  v_done := array[]::boolean[];
  for i in 1 .. v_n loop
    v_done := v_done || coalesce(v_part.objectives_done[i], false);
  end loop;
  v_done[p_index + 1] := coalesce(p_done, false);

  update public.quest_participants set objectives_done = v_done where quest_id = p_quest_id and user_id = v_uid;
  return v_done;
end;
$$;

-- Le rapport en parties : une par mission (p_parts, dans l'ordre) et un bilan.
create or replace function public.submit_quest_report_parts(p_quest_id uuid, p_parts text[], p_summary text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_part public.quest_participants;
  v_quest public.quests;
  v_nick text;
  v_n int;
  v_parts text[] := array[]::text[];
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_text text;
  v_full text;
  i int;
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  select * into v_part from public.quest_participants where quest_id = p_quest_id and user_id = v_uid;
  if v_part.quest_id is null then return jsonb_build_object('error', 'not_participant'); end if;
  if v_part.status = 'rejected' then return jsonb_build_object('error', 'rejected'); end if;
  select * into v_quest from public.quests where id = p_quest_id;
  v_n := coalesce(cardinality(v_quest.objectives), 0);

  for i in 1 .. v_n loop
    v_text := btrim(coalesce(p_parts[i], ''));
    if char_length(v_text) > 2000 then return jsonb_build_object('error', 'part_too_long', 'index', i - 1); end if;
    v_parts := v_parts || v_text;
  end loop;
  if v_summary is not null and char_length(v_summary) > 4000 then return jsonb_build_object('error', 'too_long'); end if;

  -- Texte complet : « ◆ mission » puis sa partie, pour chaque mission racontée, puis le bilan.
  select concat_ws(E'\n\n',
           (select string_agg('◆ ' || o.obj || E'\n' || p.txt, E'\n\n' order by o.i)
              from unnest(v_quest.objectives) with ordinality as o(obj, i)
              join unnest(v_parts) with ordinality as p(txt, i) using (i)
             where p.txt <> ''),
           v_summary)
    into v_full;
  -- Au moins 20 caractères écrits par le membre (les titres des missions ne comptent pas).
  if coalesce((select sum(char_length(x)) from unnest(v_parts) x), 0) + char_length(coalesce(v_summary, '')) < 20 then
    return jsonb_build_object('error', 'too_short');
  end if;

  update public.quest_participants
     set report = v_full,
         report_parts = v_parts,
         report_summary = v_summary,
         report_at = now(),
         status = case when status = 'assigned' then 'submitted' else status end
   where quest_id = p_quest_id and user_id = v_uid;

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

-- Les rapports d'une quête (0078) : avec les missions cochées et les parties.
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
             'report', qp.report, 'report_at', qp.report_at,
             'parts', to_jsonb(qp.report_parts), 'summary', qp.report_summary,
             'done', to_jsonb(qp.objectives_done))
           order by qp.report_at nulls last)
      from public.quest_participants qp
      join public.profiles p on p.id = qp.user_id
     where qp.quest_id = p_quest_id
  ), '[]'::jsonb);
end;
$$;

-- Chroniques (0078) : avec les missions et les parties de chaque rapport.
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
               'objectives', to_jsonb(q.objectives),
               'at', max(qp.report_at),
               'reports', jsonb_agg(jsonb_build_object('nickname', p.nickname, 'report', qp.report, 'at', qp.report_at,
                                                       'parts', to_jsonb(qp.report_parts), 'summary', qp.report_summary)
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

revoke all on function public.quest_objective_set(uuid, int, boolean) from public, anon;
revoke all on function public.submit_quest_report_parts(uuid, text[], text) from public, anon;
grant execute on function public.quest_objective_set(uuid, int, boolean) to authenticated;
grant execute on function public.submit_quest_report_parts(uuid, text[], text) to authenticated;
