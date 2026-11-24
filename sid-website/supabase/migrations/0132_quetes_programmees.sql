-- =====================================================================
-- 0132 — Lot 102 : quêtes programmées. Rejouable. À lancer après 0131.
--
-- Une quête peut avoir une date de publication (publish_at). Avant cette
-- date, seuls son auteur et les admins « Quêtes » la voient ; personne ne
-- peut s'y inscrire. Elle devient visible à la seconde près (la règle de
-- lecture compare publish_at à l'heure), et les membres sont prévenus dans
-- la minute (tâches de fond). Une échéance doit tomber après la publication.
-- Aussi : run_scheduled_jobs lance les trajets programmés de la Cartographie
-- (migration Carto 0123) quand elle est en place.
-- =====================================================================

alter table public.quests add column if not exists publish_at timestamptz;
alter table public.quests add column if not exists publish_notified_at timestamptz;
create index if not exists quests_publish_idx on public.quests (publish_at) where publish_at is not null and publish_notified_at is null;

-- Lecture : une quête programmée reste cachée jusqu'à sa publication.
drop policy if exists quests_select on public.quests;
create policy quests_select on public.quests for select using (
  ((visibility = 'public')
    or ((visibility = 'members') and (auth.uid() is not null))
    or ((visibility = 'private') and ((created_by = auth.uid()) or has_permission(auth.uid(), 'manage_quests') or is_quest_participant(id, auth.uid()))))
  and (publish_at is null or publish_at <= now() or created_by = auth.uid() or has_permission(auth.uid(), 'manage_quests'))
);

-- Échéance après la publication ; publication dans le futur à la création
-- (une date passée équivaut à « maintenant »).
create or replace function public._quest_publication_garde()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.publish_at is not null and new.publish_at <= now() and (tg_op = 'INSERT' or old.publish_at is distinct from new.publish_at) then
    new.publish_at := null;
  end if;
  if new.publish_at is not null and new.deadline is not null and new.deadline <= new.publish_at then
    raise exception 'L''échéance doit tomber après la publication.';
  end if;
  if tg_op = 'UPDATE' and old.publish_at is distinct from new.publish_at then
    new.publish_notified_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_quest_publication on public.quests;
create trigger trg_quest_publication before insert or update on public.quests
  for each row execute function public._quest_publication_garde();

-- Pas d'inscription avant la publication.
create or replace function public._quest_participant_publication()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_at timestamptz;
begin
  select publish_at into v_at from public.quests where id = new.quest_id;
  if v_at is not null and v_at > now() then
    raise exception 'Cette quête n''est pas encore publiée (le %).', to_char(v_at at time zone public.stats_timezone(), 'DD/MM à HH24"h"MI');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_quest_participant_publication on public.quest_participants;
create trigger trg_quest_participant_publication before insert on public.quest_participants
  for each row execute function public._quest_participant_publication();

-- Notification « nouvelle quête » (réglable par chaque membre).
do $$
declare
  v_def text;
  v_list text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  v_list := string_to_array((regexp_match(v_def, '\{([^}]*)\}'))[1], ',');
  if not 'quest_new' = any (v_list) then
    v_list := v_list || 'quest_new'::text;
    alter table public.notifications drop constraint notifications_type_check;
    execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_list);
  end if;
end $$;

create or replace function public._notif_mutable(p_type text)
returns boolean
language sql immutable
as $$
  select p_type = any (array[
    'chat_message', 'money_received', 'salary_paid', 'auction', 'market', 'gift', 'wishlist',
    'business', 'quest_gacha', 'title', 'troll', 'poll', 'wedding',
    'travel_arrived', 'exploration', 'incursion', 'wiki', 'propriete', 'rappel', 'quest_new'
  ]);
$$;

-- Publication : les membres sont prévenus (quêtes publiques et « membres »).
create or replace function public.quests_publish_due()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  q public.quests;
  n int := 0;
begin
  for q in
    select * from public.quests
    where publish_at is not null and publish_at <= now() and publish_notified_at is null
    order by publish_at
    limit 50
    for update skip locked
  loop
    update public.quests set publish_notified_at = now() where id = q.id;
    -- Publiée depuis plus d'un jour (tâches de fond arrêtées) : pas de rafale.
    if q.status in ('open', 'in_progress') and q.visibility in ('public', 'members') and q.publish_at > now() - interval '1 day' then
      insert into public.notifications (user_id, type, title, body, link)
      select p.id, 'quest_new', 'Nouvelle quête : ' || q.title,
             'Rang ' || q.difficulty || coalesce(' · ' || nullif(q.reward, 0)::text || ' z', '')
             || coalesce(' · jusqu''au ' || to_char(q.deadline at time zone public.stats_timezone(), 'DD/MM à HH24"h"MI'), ''),
             '/dashboard/quests'
      from public.profiles p
      where p.status = 'active' and p.id is distinct from q.created_by;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Tâches de fond (reprise de 0129).
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_last timestamptz;
  v_n int;
begin
  v := v || jsonb_build_object('sondages', public.polls_publish_due());
  v := v || jsonb_build_object('rappels', public.auctions_remind_due());
  v := v || jsonb_build_object('encheres', public.auctions_settle_due());
  v := v || jsonb_build_object('bourse', public.process_market());

  -- Lot 98 : rappels personnels et nouvelles connexions.
  begin
    v := v || jsonb_build_object('rappels_perso', public.rappels_envoyer_dus());
    v := v || jsonb_build_object('connexions', public._appareils_scanner(null));
  exception when others then
    v := v || jsonb_build_object('lot98_erreur', sqlerrm);
  end;

  -- Lot 101 : versements de la banque isolée (après les 48 h).
  begin
    v := v || jsonb_build_object('banque_isolee', public.banque_isolee_verser_dus());
  exception when others then
    v := v || jsonb_build_object('banque_isolee_erreur', sqlerrm);
  end;

  -- Lot 102 : quêtes programmées (notifications à la publication) et
  -- trajets programmés de la Cartographie (migration Carto 0123, si lancée).
  begin
    v := v || jsonb_build_object('quetes_publiees', public.quests_publish_due());
    if to_regprocedure('public.trajets_programmes_lancer(uuid)') is not null then
      execute 'select public.trajets_programmes_lancer(null)' into v_n;
      v := v || jsonb_build_object('trajets_programmes', v_n);
    end if;
  exception when others then
    v := v || jsonb_build_object('lot102_erreur', sqlerrm);
  end;

  select value::timestamptz into v_last from public.app_config where key = 'notif_cleanup_last';
  if v_last is null or v_last < now() - interval '1 hour' then
    perform public._cfg_set_ts('notif_cleanup_last');
    v := v || jsonb_build_object('nettoyage', public.notifications_cleanup());
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'bankruptcy_last_check';
  if v_last is null or v_last < now() - interval '1 hour' then
    perform public._cfg_set_ts('bankruptcy_last_check');
    v := v || jsonb_build_object('faillites', public.businesses_check_bankruptcy());
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'taxes_last_check';
  if v_last is null or v_last < now() - interval '15 minutes' then
    perform public._cfg_set_ts('taxes_last_check');
    perform public.process_weekly_taxes();
    v := v || jsonb_build_object('impots', public.taxes_process_due());
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'economy_last_daily';
  if v_last is null or (v_last at time zone public.stats_timezone())::date < (now() at time zone public.stats_timezone())::date then
    perform public._cfg_set_ts('economy_last_daily');
    v := v || jsonb_build_object('population', public._population_catch_up());
    v := v || jsonb_build_object('economie', public.economy_update(false));
  end if;

  select value::timestamptz into v_last from public.app_config where key = 'inactivity_last_run';
  if v_last is null or (v_last at time zone public.stats_timezone())::date < public._local_today() then
    perform public._cfg_set_ts('inactivity_last_run');
    v := v || jsonb_build_object('absences', public.process_inactivity());
  end if;
  return v;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public._quest_publication_garde()', 'public._quest_participant_publication()', 'public.quests_publish_due()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
