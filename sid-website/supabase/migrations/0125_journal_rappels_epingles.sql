-- =====================================================================
-- 0125 — Lot 98 : journal du compte, alerte de nouvel appareil, rappels
-- personnels, épingles, contraste renforcé.
--
-- * journal_compte : ce qui touche le compte d'un membre (connexions et
--   appareil utilisé, sessions fermées, réglages, export, actions de
--   l'équipe sur le compte). journal_mon_compte() le lit, avec les
--   événements de connexion de Supabase (mot de passe changé, lien de
--   récupération…) et les demandes de suppression. Lisible par le membre
--   seul ; gardé un an.
-- * Alerte de nouvel appareil : _appareils_scanner() relève les sessions
--   ouvertes depuis le dernier passage (chaque minute avec run_scheduled_jobs,
--   et à la lecture du journal). Une connexion depuis un navigateur ou un
--   système jamais vu sur ce compte envoie une notification « securite »
--   (non désactivable, envoyée aussi en push).
-- * rappels : rappels personnels du Calendrier (date et heure, ou toute la
--   journée à 8 h), avec notification « rappel » à l'heure dite.
--   calendrier() les renvoie avec le reste.
-- * epingles : membres, quêtes, lieux et bâtiments épinglés ; les fiches du
--   Wiki passent par les favoris existants (wiki_favorites). mes_epingles()
--   ne renvoie que ce que le membre peut encore voir.
-- * display_prefs_set accepte « contraste » (normal, fort, auto).
-- Rejouable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nouveaux types de notification
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_list text[];
  t text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  v_list := string_to_array((regexp_match(v_def, '\{([^}]*)\}'))[1], ',');
  foreach t in array array['securite', 'rappel'] loop
    if not t = any (v_list) then v_list := v_list || t; end if;
  end loop;
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_list);
end $$;

-- Les rappels se règlent comme les autres catégories ; « securite » jamais.
create or replace function public._notif_mutable(p_type text)
returns boolean
language sql immutable
as $$
  select p_type = any (array[
    'chat_message', 'money_received', 'salary_paid', 'auction', 'market', 'gift', 'wishlist',
    'business', 'quest_gacha', 'title', 'troll', 'poll', 'wedding',
    'travel_arrived', 'exploration', 'incursion', 'wiki', 'propriete', 'rappel'
  ]);
$$;

-- ---------------------------------------------------------------------
-- 1. Journal du compte
-- ---------------------------------------------------------------------
create table if not exists public.journal_compte (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  label text not null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists journal_compte_user_at on public.journal_compte (user_id, at desc);
alter table public.journal_compte enable row level security;
revoke all on public.journal_compte from anon, authenticated;

-- Une ligne ; la même chose par la même personne dans les 10 minutes ne
-- fait qu'avancer l'heure.
create or replace function public._journal_noter(
  p_user uuid, p_kind text, p_label text, p_details jsonb default '{}'::jsonb,
  p_at timestamptz default now(), p_grouper boolean default true)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then return; end if;
  if p_grouper then
    select id into v_id from public.journal_compte
    where user_id = p_user and kind = p_kind and label = p_label and at > now() - interval '10 minutes'
      and details->>'par' is not distinct from p_details->>'par'
    order by at desc limit 1;
    if v_id is not null then
      update public.journal_compte set at = greatest(at, p_at), details = coalesce(p_details, '{}'::jsonb) where id = v_id;
      return;
    end if;
  end if;
  insert into public.journal_compte (user_id, at, kind, label, details)
  values (p_user, coalesce(p_at, now()), p_kind, left(p_label, 200), coalesce(p_details, '{}'::jsonb));
  delete from public.journal_compte where user_id = p_user and at < now() - interval '1 year';
end;
$$;

-- Réglages et fiche : qui (le membre ou l'équipe), jamais le contenu privé.
create or replace function public._journal_profil()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_par text;
begin
  if v_actor is null then return new; end if;
  v_par := case when v_actor = new.id then 'toi' else 'equipe' end;

  if new.nickname is distinct from old.nickname then
    perform public._journal_noter(new.id, 'reglage', 'Surnom changé', jsonb_build_object('par', v_par, 'avant', old.nickname, 'apres', new.nickname));
  end if;
  if new.avatar_url is distinct from old.avatar_url then
    perform public._journal_noter(new.id, 'reglage', 'Photo changée', jsonb_build_object('par', v_par));
  end if;
  if (new.first_name, new.last_name, new.age, new.description, new.weapons, new.equipment)
     is distinct from (old.first_name, old.last_name, old.age, old.description, old.weapons, old.equipment) then
    perform public._journal_noter(new.id, 'reglage', 'Fiche modifiée', jsonb_build_object('par', v_par));
  end if;
  if (new.hidden_fields, new.presence_visible, new.activity_visible, new.is_invisible)
     is distinct from (old.hidden_fields, old.presence_visible, old.activity_visible, old.is_invisible) then
    perform public._journal_noter(new.id, 'reglage', 'Confidentialité réglée', jsonb_build_object('par', v_par));
  end if;
  if (new.notif_muted, new.notif_push_muted, new.push_quiet_start, new.push_quiet_end)
     is distinct from (old.notif_muted, old.notif_push_muted, old.push_quiet_start, old.push_quiet_end) then
    perform public._journal_noter(new.id, 'reglage', 'Notifications réglées', jsonb_build_object('par', v_par));
  end if;
  if new.display_prefs is distinct from old.display_prefs then
    perform public._journal_noter(new.id, 'reglage', 'Affichage réglé', jsonb_build_object('par', v_par));
  end if;
  if new.terms_version is distinct from old.terms_version and new.terms_version is not null then
    perform public._journal_noter(new.id, 'reglage', 'Conditions acceptées (version ' || new.terms_version || ')', jsonb_build_object('par', v_par));
  end if;
  if v_par = 'equipe' then
    if new.member_rank is distinct from old.member_rank then
      perform public._journal_noter(new.id, 'equipe', 'Rang changé : ' || coalesce(new.member_rank, '—'), jsonb_build_object('par', v_par));
    end if;
    if (new.mute_until, new.is_frozen, new.freeze_until, new.ban_until, new.status)
       is distinct from (old.mute_until, old.is_frozen, old.freeze_until, old.ban_until, old.status) then
      perform public._journal_noter(new.id, 'equipe', 'Restrictions du compte modifiées par l''équipe', jsonb_build_object('par', v_par));
    end if;
  end if;
  return new;
exception when others then
  -- Le journal ne bloque jamais une modification de fiche.
  return new;
end;
$$;

drop trigger if exists trg_journal_profil on public.profiles;
create trigger trg_journal_profil after update on public.profiles
  for each row execute function public._journal_profil();

-- Fermer une session : noté avec l'appareil.
create or replace function public.appareil_deconnecter(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
  v_ua text;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform public._limite_debit('appareils', 20, 60);
  if p_id is null then raise exception 'Appareil manquant.'; end if;
  if p_id::text = coalesce(auth.jwt() ->> 'session_id', '') then
    raise exception 'C''est cet appareil : utilise « Se déconnecter ».';
  end if;
  if to_regclass('auth.sessions') is null then return jsonb_build_object('ok', false); end if;
  execute 'select to_jsonb(s)->>''user_agent'' from auth.sessions s where s.id = $1 and s.user_id = $2' into v_ua using p_id, v_uid;
  execute 'delete from auth.sessions where id = $1 and user_id = $2' using p_id, v_uid;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform public.write_audit('session_revoked', v_uid, jsonb_build_object('session', p_id));
    perform public._journal_noter(v_uid, 'appareil_ferme', 'Session fermée : ' || public._nom_appareil(v_ua),
                                  jsonb_build_object('par', 'toi', 'session', p_id), now(), false);
  end if;
  return jsonb_build_object('ok', v_n > 0);
end;
$$;

-- « Chrome sur Windows »… (même règle que ConnectedDevices.tsx).
create or replace function public._nom_appareil(p_ua text)
returns text
language sql immutable
as $$
  select case when coalesce(p_ua, '') = '' then 'Appareil inconnu' else
    (case when p_ua ~ 'Edg/' then 'Edge'
          when p_ua ~ 'OPR/|Opera' then 'Opera'
          when p_ua ~ 'Firefox/' then 'Firefox'
          when p_ua ~ 'SamsungBrowser' then 'Samsung Internet'
          when p_ua ~ 'Chrome/|CriOS' then 'Chrome'
          when p_ua ~ 'Safari/' then 'Safari'
          else 'Navigateur' end)
    || coalesce(' sur ' || case when p_ua ~ 'iPhone' then 'iPhone'
                                when p_ua ~ 'iPad' then 'iPad'
                                when p_ua ~ 'Android' then 'Android'
                                when p_ua ~ 'Windows' then 'Windows'
                                when p_ua ~ 'Mac OS X|Macintosh' then 'Mac'
                                when p_ua ~ 'CrOS' then 'ChromeOS'
                                when p_ua ~ 'Linux' then 'Linux' end, '')
  end;
$$;

-- Export : noté dans le journal (la fonction complète garde son contenu).
do $$
begin
  if to_regprocedure('public._export_my_data_complet()') is null and to_regprocedure('public.export_my_data()') is not null then
    alter function public.export_my_data() rename to _export_my_data_complet;
  end if;
end $$;

create or replace function public.export_my_data()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_out jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  v_out := public._export_my_data_complet();
  perform public._journal_noter(auth.uid(), 'export', 'Export de tes données', jsonb_build_object('par', 'toi'));
  return v_out;
end;
$$;
revoke execute on function public._export_my_data_complet() from public, anon, authenticated;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Appareils connus et alerte de nouvel appareil
-- ---------------------------------------------------------------------
create table if not exists public.appareils_connus (
  user_id uuid not null references public.profiles (id) on delete cascade,
  nom text not null,
  premier_at timestamptz not null default now(),
  dernier_at timestamptz not null default now(),
  primary key (user_id, nom)
);
alter table public.appareils_connus enable row level security;
revoke all on public.appareils_connus from anon, authenticated;

create table if not exists public.sessions_vues (
  session_id uuid primary key,
  user_id uuid not null,
  vu_at timestamptz not null default now()
);
alter table public.sessions_vues enable row level security;
revoke all on public.sessions_vues from anon, authenticated;

-- Sessions ouvertes depuis le dernier passage (p_user : un seul membre).
create or replace function public._appareils_scanner(p_user uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_nom text;
  v_connus int;
  v_nouveau boolean;
  v_n int := 0;
  v_tz text := public.stats_timezone();
begin
  if to_regclass('auth.sessions') is null then return 0; end if;
  for r in execute $q$
    select s.id, s.user_id, coalesce(s.created_at, now()) as created_at,
           to_jsonb(s)->>'user_agent' as ua, to_jsonb(s)->>'ip' as ip
    from auth.sessions s
    where ($1::uuid is null or s.user_id = $1)
      and coalesce(s.created_at, now()) > now() - interval '30 days'
      and not exists (select 1 from public.sessions_vues v where v.session_id = s.id)
      and exists (select 1 from public.profiles p where p.id = s.user_id)
    order by s.created_at
    limit 500
  $q$ using p_user
  loop
    insert into public.sessions_vues (session_id, user_id) values (r.id, r.user_id) on conflict do nothing;
    if not found then continue; end if;
    v_nom := public._nom_appareil(r.ua);
    select count(*) into v_connus from public.appareils_connus where user_id = r.user_id;
    insert into public.appareils_connus (user_id, nom, premier_at, dernier_at)
    values (r.user_id, v_nom, r.created_at, r.created_at)
    on conflict (user_id, nom) do update set dernier_at = greatest(public.appareils_connus.dernier_at, excluded.dernier_at)
    returning (xmax = 0) into v_nouveau;
    perform public._journal_noter(r.user_id, 'connexion', 'Connexion : ' || v_nom,
      jsonb_strip_nulls(jsonb_build_object('appareil', v_nom, 'ip', r.ip, 'session', r.id)), r.created_at, false);
    if v_nouveau and v_connus > 0 then
      perform public._journal_noter(r.user_id, 'appareil_nouveau', 'Nouvel appareil : ' || v_nom,
        jsonb_strip_nulls(jsonb_build_object('appareil', v_nom, 'ip', r.ip, 'session', r.id)), r.created_at, false);
      insert into public.notifications (user_id, type, title, body, link)
      values (r.user_id, 'securite', 'Connexion depuis un nouvel appareil',
              v_nom || ', le ' || to_char(r.created_at at time zone v_tz, 'DD/MM à HH24:MI')
                || '. Si ce n''est pas toi : ferme cette session dans Mes données et change ton mot de passe.',
              '/dashboard/privacy#appareils');
    end if;
    v_n := v_n + 1;
  end loop;
  if p_user is null then
    delete from public.sessions_vues where vu_at < now() - interval '60 days';
  end if;
  return v_n;
end;
$$;
revoke execute on function public._appareils_scanner(uuid) from public, anon, authenticated;

-- Point de départ : les sessions et appareils déjà là ne déclenchent rien.
do $$
begin
  if to_regclass('auth.sessions') is null then return; end if;
  execute $q$
    insert into public.appareils_connus (user_id, nom, premier_at, dernier_at)
    select s.user_id, public._nom_appareil(to_jsonb(s)->>'user_agent'), min(coalesce(s.created_at, now())), max(coalesce(s.created_at, now()))
    from auth.sessions s
    where exists (select 1 from public.profiles p where p.id = s.user_id)
    group by 1, 2
    on conflict do nothing
  $q$;
  execute $q$
    insert into public.journal_compte (user_id, at, kind, label, details)
    select s.user_id, coalesce(s.created_at, now()), 'connexion', 'Connexion : ' || public._nom_appareil(to_jsonb(s)->>'user_agent'),
           jsonb_strip_nulls(jsonb_build_object('appareil', public._nom_appareil(to_jsonb(s)->>'user_agent'), 'ip', to_jsonb(s)->>'ip', 'session', s.id))
    from auth.sessions s
    where exists (select 1 from public.profiles p where p.id = s.user_id)
      and not exists (select 1 from public.sessions_vues v where v.session_id = s.id)
  $q$;
  execute $q$
    insert into public.sessions_vues (session_id, user_id)
    select s.id, s.user_id from auth.sessions s
    on conflict do nothing
  $q$;
end $$;

-- Le journal, du plus récent au plus ancien (200 lignes au plus).
create or replace function public.journal_mon_compte()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform public._limite_debit('journal', 20, 60);
  perform public._appareils_scanner(v_uid);

  select coalesce(jsonb_agg(jsonb_build_object('at', j.at, 'kind', j.kind, 'label', j.label, 'details', j.details)), '[]')
  into v_part
  from (select * from public.journal_compte where user_id = v_uid order by at desc limit 200) j;
  v_out := v_out || v_part;

  -- Ce que l'équipe a fait sur le compte (liste fermée : rien d'interne).
  select coalesce(jsonb_agg(jsonb_build_object('at', a.created_at, 'kind', 'equipe',
           'label', case a.action
                      when 'role_assigned' then 'Rôle reçu : ' || coalesce(a.details->>'role', '?')
                      when 'role_removed' then 'Rôle retiré : ' || coalesce(a.details->>'role', '?')
                      when 'permission_granted' then 'Permission ajoutée à ton rôle'
                      when 'permission_revoked' then 'Permission retirée de ton rôle'
                      when 'session_revoked' then 'Session fermée par l''équipe'
                      when 'inactivity_exempt' then 'Dispense d''absence' || coalesce(' jusqu''au ' || to_char((a.details->>'until')::date, 'DD/MM/YYYY'), '')
                      when 'account_invisible' then 'Visibilité du compte changée par l''équipe'
                    end,
           'details', jsonb_build_object('par', 'equipe'))), '[]')
  into v_part
  from (select * from public.audit_log
        where target_user_id = v_uid and actor_id is distinct from v_uid
          and action in ('role_assigned', 'role_removed', 'permission_granted', 'permission_revoked', 'session_revoked', 'inactivity_exempt', 'account_invisible')
          and created_at > now() - interval '1 year'
        order by created_at desc limit 50) a;
  v_out := v_out || v_part;

  -- Demandes de suppression du compte.
  select coalesce(jsonb_agg(jsonb_build_object('at', r.created_at, 'kind', 'suppression',
           'label', 'Demande de suppression du compte (' || case r.status when 'pending' then 'en attente' when 'done' then 'faite'
                                                                        when 'refused' then 'refusée' when 'cancelled' then 'annulée' else r.status end || ')',
           'details', jsonb_build_object('par', 'toi'))), '[]')
  into v_part
  from public.privacy_requests r where r.user_id = v_uid and r.created_at > now() - interval '1 year';
  v_out := v_out || v_part;

  -- Événements de connexion de Supabase (90 jours).
  if to_regclass('auth.audit_log_entries') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('at', e.created_at, 'kind', 'compte',
               'label', case e.payload->>'action'
                          when 'user_signedup' then 'Compte créé'
                          when 'user_updated_password' then 'Mot de passe changé'
                          when 'user_recovery_requested' then 'Lien de nouveau mot de passe demandé'
                          when 'user_modified' then 'Adresse ou identifiants du compte modifiés'
                          when 'logout' then 'Déconnexion'
                        end,
               'details', jsonb_strip_nulls(jsonb_build_object('ip', nullif(e.ip_address, ''))))), '[]')
      from (select * from auth.audit_log_entries
            where created_at > now() - interval '90 days'
              and payload->>'actor_id' = $1::text
              and payload->>'action' in ('user_signedup', 'user_updated_password', 'user_recovery_requested', 'user_modified', 'logout')
            order by created_at desc limit 100) e
    $q$ into v_part using v_uid;
    v_out := v_out || v_part;
  end if;

  return coalesce((select jsonb_agg(x order by (x->>'at')::timestamptz desc) from jsonb_array_elements(v_out) x), '[]'::jsonb);
end;
$$;
revoke execute on function public.journal_mon_compte() from public, anon;
grant execute on function public.journal_mon_compte() to authenticated;
revoke execute on function public._journal_noter(uuid, text, text, jsonb, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public._journal_profil() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Rappels personnels
-- ---------------------------------------------------------------------
create table if not exists public.rappels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  titre text not null check (char_length(titre) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  at timestamptz not null,
  jour boolean not null default false,
  notifier boolean not null default true,
  envoye_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rappels_user_at on public.rappels (user_id, at);
create index if not exists rappels_a_envoyer on public.rappels (at) where notifier and envoye_at is null;
alter table public.rappels enable row level security;
revoke all on public.rappels from anon, authenticated;

-- Heure d'envoi : l'heure dite, ou 8 h le jour même pour « toute la journée ».
create or replace function public._rappel_echeance(p_at timestamptz, p_jour boolean)
returns timestamptz
language sql stable
as $$
  select case when p_jour then p_at + interval '8 hours' else p_at end;
$$;

create or replace function public.rappel_enregistrer(
  p_id uuid, p_titre text, p_at timestamptz, p_jour boolean default false,
  p_note text default null, p_notifier boolean default true)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := public.stats_timezone();
  v_titre text := btrim(coalesce(p_titre, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_at timestamptz := p_at;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform public._limite_debit('rappels', 30, 60);
  if v_titre = '' then raise exception 'Donne un titre au rappel.'; end if;
  if char_length(v_titre) > 120 then raise exception 'Titre trop long (120 caractères au plus).'; end if;
  if char_length(coalesce(v_note, '')) > 500 then raise exception 'Note trop longue (500 caractères au plus).'; end if;
  if v_at is null then raise exception 'Choisis une date.'; end if;
  if coalesce(p_jour, false) then
    v_at := ((v_at at time zone v_tz)::date)::timestamp at time zone v_tz;
  end if;
  if v_at < now() - interval '1 year' or v_at > now() + interval '5 years' then
    raise exception 'Date hors limites (d''un an en arrière à cinq ans devant).';
  end if;

  if p_id is null then
    if (select count(*) from public.rappels where user_id = v_uid and at > now() - interval '1 day') >= 300 then
      raise exception 'Trop de rappels à venir (300 au plus).';
    end if;
    insert into public.rappels (user_id, titre, note, at, jour, notifier)
    values (v_uid, v_titre, v_note, v_at, coalesce(p_jour, false), coalesce(p_notifier, true))
    returning id into v_id;
  else
    update public.rappels
    set titre = v_titre, note = v_note, at = v_at, jour = coalesce(p_jour, false), notifier = coalesce(p_notifier, true),
        envoye_at = case when public._rappel_echeance(v_at, coalesce(p_jour, false)) > now() then null else envoye_at end
    where id = p_id and user_id = v_uid
    returning id into v_id;
    if v_id is null then raise exception 'Rappel introuvable.'; end if;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.rappel_enregistrer(uuid, text, timestamptz, boolean, text, boolean) from public, anon;
grant execute on function public.rappel_enregistrer(uuid, text, timestamptz, boolean, text, boolean) to authenticated;

create or replace function public.rappel_supprimer(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  delete from public.rappels where id = p_id and user_id = auth.uid();
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke execute on function public.rappel_supprimer(uuid) from public, anon;
grant execute on function public.rappel_supprimer(uuid) to authenticated;

-- Rappels arrivés à l'heure : une notification chacun (au plus 24 h de retard).
create or replace function public.rappels_envoyer_dus()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_tz text := public.stats_timezone();
  v_n int := 0;
begin
  for r in
    select * from public.rappels
    where notifier and envoye_at is null and at <= now() + interval '1 day'
      and public._rappel_echeance(at, jour) <= now()
    order by at
    limit 500
    for update skip locked
  loop
    update public.rappels set envoye_at = now() where id = r.id;
    if public._rappel_echeance(r.at, r.jour) > now() - interval '1 day' then
      insert into public.notifications (user_id, type, title, body, link)
      values (r.user_id, 'rappel', 'Rappel : ' || r.titre,
              coalesce(r.note, case when r.jour then 'Aujourd''hui' else 'À ' || to_char(r.at at time zone v_tz, 'HH24:MI') end),
              '/dashboard/calendrier?jour=' || to_char(r.at at time zone v_tz, 'YYYY-MM-DD'));
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.rappels_envoyer_dus() from public, anon, authenticated;

-- calendrier() : 0123 + les rappels du lecteur.
create or replace function public.calendrier(p_debut date, p_fin date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := public.stats_timezone();
  v_d0 timestamptz;
  v_d1 timestamptz;
  v_out jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_debut is null or p_fin is null or p_fin < p_debut then raise exception 'Période invalide.'; end if;
  if p_fin - p_debut > 100 then raise exception 'Période trop longue (100 jours au plus).'; end if;
  v_d0 := p_debut::timestamp at time zone v_tz;
  v_d1 := (p_fin + 1)::timestamp at time zone v_tz;

  select coalesce(jsonb_agg(jsonb_build_object('kind', 'quete', 'id', q.id, 'titre', q.title,
           'debut', q.deadline, 'detail', 'Rang ' || q.difficulty || ' · ' || round(coalesce(q.reward, 0)) || ' z',
           'lien', '/dashboard/quests?quete=' || q.id,
           'moi', public.is_quest_participant(q.id, v_uid))), '[]') into v_part
  from public.quests q
  where q.deadline >= v_d0 and q.deadline < v_d1 and q.status in ('open', 'in_progress')
    and (q.visibility in ('public', 'members') or q.created_by = v_uid
         or public.has_permission(v_uid, 'manage_quests') or public.is_quest_participant(q.id, v_uid));
  v_out := v_out || v_part;

  select coalesce(jsonb_agg(jsonb_build_object('kind', 'enchere', 'id', a.id, 'titre', i.name || case when a.quantity > 1 then ' ×' || a.quantity else '' end,
           'debut', a.ends_at, 'detail', 'Enchère : ' || round(a.current_price) || ' z' || case when a.top_bidder = v_uid then ' (tu mènes)' else '' end,
           'lien', '/dashboard/shop?enchere=' || a.id,
           'moi', a.top_bidder = v_uid or a.seller_id = v_uid)), '[]') into v_part
  from public.auctions a join public.shop_items i on i.id = a.item_id
  where a.status = 'open' and a.ends_at >= v_d0 and a.ends_at < v_d1;
  v_out := v_out || v_part;

  select coalesce(jsonb_agg(jsonb_build_object('kind', 'sondage', 'id', p.id, 'titre', p.question,
           'debut', p.closes_at,
           'detail', case when exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid) then 'Tu as voté'
                          when p.closes_at <= now() then 'Clos' else 'Pas encore voté' end,
           'lien', '/dashboard/polls?sondage=' || p.id,
           'moi', p.closes_at > now() and not exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid))), '[]') into v_part
  from public.polls p
  where p.closed_at is null and p.closes_at >= v_d0 and p.closes_at < v_d1
    and (p.publish_at is null or p.publish_at <= now());
  v_out := v_out || v_part;

  select coalesce(jsonb_agg(jsonb_build_object('kind', 'anniversaire', 'id', pr.id, 'titre', pr.nickname,
           'debut', d, 'jour', true, 'detail', 'Anniversaire', 'lien', '/dashboard/profile/' || pr.id,
           'image', pr.avatar_url, 'moi', pr.id = v_uid)), '[]') into v_part
  from public.member_birthdays b
  join public.profiles pr on pr.id = b.user_id and pr.status = 'active' and (not coalesce(pr.is_invisible, false) or pr.id = v_uid)
  cross join lateral (
    select make_date(y, b.month, case when b.month = 2 and b.day = 29 and not (y % 4 = 0 and (y % 100 <> 0 or y % 400 = 0)) then 28 else b.day end) as d
    from generate_series(extract(year from p_debut)::int, extract(year from p_fin)::int) y
  ) x
  where x.d between p_debut and p_fin;
  v_out := v_out || v_part;

  select coalesce(jsonb_agg(jsonb_build_object('kind', 'impot', 'id', t.id, 'titre', 'Impôt à payer',
           'debut', t.due_at, 'detail', round(t.amount) || ' z', 'lien', '/dashboard/bank', 'moi', true)), '[]') into v_part
  from public.tax_bills t
  where t.user_id = v_uid and t.status = 'due' and t.due_at >= v_d0 and t.due_at < v_d1;
  v_out := v_out || v_part;

  select coalesce(jsonb_agg(jsonb_build_object('kind', 'evenement', 'id', k || ':' || d0, 'titre', k,
           'debut', d0, 'fin', d1, 'jour', true)), '[]') into v_part
  from (
    select k, min(d) as d0, max(d) as d1
    from (
      select k, d, d - (row_number() over (partition by k order by d))::int as grp
      from unnest(public._decor_keys()) k
      cross join generate_series(p_debut, p_fin, interval '1 day') g(dd)
      cross join lateral (select g.dd::date as d) x
      where public._decor_window(k, x.d)
    ) s
    group by k, grp
  ) e;
  v_out := v_out || v_part;

  -- Rappels du lecteur (Lot 98).
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'rappel', 'id', r.id, 'titre', r.titre,
           'debut', case when r.jour then to_jsonb((r.at at time zone v_tz)::date) else to_jsonb(r.at) end,
           'jour', r.jour, 'detail', r.note, 'notifier', r.notifier,
           'envoye', r.envoye_at is not null, 'moi', true)), '[]') into v_part
  from public.rappels r
  where r.user_id = v_uid and r.at >= v_d0 and r.at < v_d1;
  v_out := v_out || v_part;

  return v_out;
end;
$$;
revoke execute on function public.calendrier(date, date) from public, anon;
grant execute on function public.calendrier(date, date) to authenticated;

-- Tâches de fond : 0081 et suivantes + rappels et appareils.
create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  v_last timestamptz;
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

-- ---------------------------------------------------------------------
-- 4. Épingles
-- ---------------------------------------------------------------------
create table if not exists public.epingles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('membre', 'quete', 'lieu', 'batiment')),
  ref uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.epingles enable row level security;
revoke all on public.epingles from anon, authenticated;

-- Ce que le membre peut voir (mêmes règles que recherche_commune).
create or replace function public._epingle_visible(p_uid uuid, p_kind text, p_ref uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_map_all boolean;
begin
  if p_kind = 'membre' then
    return exists (select 1 from public.profiles p where p.id = p_ref and p.status = 'active'
                   and (not coalesce(p.is_invisible, false) or p.id = p_uid or coalesce(public.has_permission(p_uid, 'manage_users'), false)));
  elsif p_kind = 'quete' then
    return exists (select 1 from public.quests q where q.id = p_ref
                   and (q.visibility in ('public', 'members') or q.created_by = p_uid
                        or public.has_permission(p_uid, 'manage_quests') or public.is_quest_participant(q.id, p_uid)));
  elsif p_kind in ('lieu', 'batiment') then
    if to_regclass('public.map_places') is null then return false; end if;
    v_map_all := coalesce(public.has_permission(p_uid, 'manage_map'), false)
                 or not coalesce((select s.fog_enabled from public.map_settings s where s.id = 1), true);
    return exists (
      select 1 from public.map_places m
      where m.id = case when p_kind = 'lieu' then p_ref else (select b.city_id from public.city_buildings b where b.id = p_ref) end
        and m.is_published and m.discovered_at is not null
        and (v_map_all or exists (select 1 from public.exploration_visits v where v.user_id = p_uid and v.place_id = m.id)));
  end if;
  return false;
end;
$$;
revoke execute on function public._epingle_visible(uuid, text, uuid) from public, anon, authenticated;

-- Épingler / retirer. p_ref : identifiant, ou « catégorie/numéro » pour une fiche.
create or replace function public.epingle_basculer(p_kind text, p_ref text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ref uuid;
  v_n int;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform public._limite_debit('epingles', 40, 60);
  if p_kind = 'fiche' then
    if to_regprocedure('public.wiki_favorite_toggle(text,integer)') is null then raise exception 'Le Wiki n''est pas installé.'; end if;
    if p_ref !~ '^[a-z_]+/[0-9]{1,6}$' then raise exception 'Fiche inconnue.'; end if;
    return public.wiki_favorite_toggle(split_part(p_ref, '/', 1), split_part(p_ref, '/', 2)::int);
  end if;
  if p_kind not in ('membre', 'quete', 'lieu', 'batiment') then raise exception 'On ne peut pas épingler ça.'; end if;
  begin
    v_ref := p_ref::uuid;
  exception when others then
    raise exception 'Élément inconnu.';
  end;
  delete from public.epingles where user_id = v_uid and kind = p_kind and ref = v_ref;
  get diagnostics v_n = row_count;
  if v_n > 0 then return false; end if;
  if not public._epingle_visible(v_uid, p_kind, v_ref) then raise exception 'Élément introuvable.'; end if;
  if (select count(*) from public.epingles where user_id = v_uid) >= 40 then
    raise exception 'Quarante épingles au plus : retires-en une d''abord.';
  end if;
  insert into public.epingles (user_id, kind, ref) values (v_uid, p_kind, v_ref) on conflict do nothing;
  return true;
end;
$$;
revoke execute on function public.epingle_basculer(text, text) from public, anon;
grant execute on function public.epingle_basculer(text, text) to authenticated;

-- Les épingles, avec leur nom et leur adresse d'aujourd'hui.
create or replace function public.mes_epingles()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(x), '[]') into v_part from (
    select jsonb_build_object('site', 'main', 'kind', 'membre', 'id', p.id, 'label', p.nickname,
             'hint', 'Rang ' || coalesce(p.member_rank, '?'), 'path', '/dashboard/profile/' || p.id,
             'image', p.avatar_url, 'at', e.created_at) as x
    from public.epingles e join public.profiles p on p.id = e.ref
    where e.user_id = v_uid and e.kind = 'membre' and public._epingle_visible(v_uid, 'membre', e.ref)) s;
  v_out := v_out || v_part;

  select coalesce(jsonb_agg(x), '[]') into v_part from (
    select jsonb_build_object('site', 'main', 'kind', 'quete', 'id', q.id, 'label', q.title,
             'hint', 'Rang ' || coalesce(q.difficulty, '?') || case q.status when 'in_progress' then ' · en cours'
                                                                             when 'open' then ' · ouverte' else ' · terminée' end,
             'path', '/dashboard/quests?quete=' || q.id, 'at', e.created_at) as x
    from public.epingles e join public.quests q on q.id = e.ref
    where e.user_id = v_uid and e.kind = 'quete' and public._epingle_visible(v_uid, 'quete', e.ref)) s;
  v_out := v_out || v_part;

  if to_regclass('public.map_places') is not null then
    select coalesce(jsonb_agg(x), '[]') into v_part from (
      select jsonb_build_object('site', 'map', 'kind', 'lieu', 'id', m.id, 'label', m.name,
               'hint', initcap(coalesce(m.type, 'lieu')), 'path', '/carte?lieu=' || m.id, 'at', e.created_at) as x
      from public.epingles e join public.map_places m on m.id = e.ref
      where e.user_id = v_uid and e.kind = 'lieu' and public._epingle_visible(v_uid, 'lieu', e.ref)) s;
    v_out := v_out || v_part;

    select coalesce(jsonb_agg(x), '[]') into v_part from (
      select jsonb_build_object('site', 'map', 'kind', 'batiment', 'id', b.id, 'label', coalesce(b.name, initcap(b.type)),
               'hint', m.name, 'path', '/batiment/' || b.id, 'at', e.created_at) as x
      from public.epingles e join public.city_buildings b on b.id = e.ref join public.map_places m on m.id = b.city_id
      where e.user_id = v_uid and e.kind = 'batiment' and public._epingle_visible(v_uid, 'batiment', e.ref)) s;
    v_out := v_out || v_part;
  end if;

  -- Fiches du Wiki : les favoris (découvertes seulement).
  if to_regclass('public.wiki_favorites') is not null then
    select coalesce(jsonb_agg(x), '[]') into v_part from (
      select jsonb_build_object('site', 'wiki', 'kind', 'fiche', 'id', w.category || '/' || w.number, 'label', w.title,
               'hint', initcap(w.category) || ' n° ' || lpad(w.number::text, 3, '0'),
               'path', '/' || w.category || '/' || lpad(w.number::text, 3, '0'), 'image', w.image_url, 'at', f.created_at) as x
      from public.wiki_favorites f join public.wiki_entries w on w.id = f.entry_id
      where f.user_id = v_uid and w.discovered) s;
    v_out := v_out || v_part;
  end if;

  return coalesce((select jsonb_agg(x order by (x->>'at')::timestamptz desc) from jsonb_array_elements(v_out) x), '[]'::jsonb);
end;
$$;
revoke execute on function public.mes_epingles() from public, anon;
grant execute on function public.mes_epingles() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Contraste renforcé dans les réglages d'affichage
-- ---------------------------------------------------------------------
create or replace function public.display_prefs_set(p_prefs jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then raise exception 'Réglages invalides.'; end if;
  if p_prefs->>'theme' in ('clair', 'sombre', 'auto') then v := v || jsonb_build_object('theme', p_prefs->>'theme'); end if;
  if jsonb_typeof(p_prefs->'epure') = 'boolean' then v := v || jsonb_build_object('epure', (p_prefs->>'epure')::boolean); end if;
  if p_prefs->>'motion' in ('full', 'calm', 'auto') then v := v || jsonb_build_object('motion', p_prefs->>'motion'); end if;
  if p_prefs->>'text' in ('normal', 'large', 'xlarge') then v := v || jsonb_build_object('text', p_prefs->>'text'); end if;
  if jsonb_typeof(p_prefs->'decor') = 'boolean' then v := v || jsonb_build_object('decor', (p_prefs->>'decor')::boolean); end if;
  if p_prefs->>'contraste' in ('normal', 'fort', 'auto') then v := v || jsonb_build_object('contraste', p_prefs->>'contraste'); end if;
  update public.profiles set display_prefs = v where id = auth.uid();
  return v;
end;
$$;
grant execute on function public.display_prefs_set(jsonb) to authenticated;
revoke execute on function public.display_prefs_set(jsonb) from public, anon;
