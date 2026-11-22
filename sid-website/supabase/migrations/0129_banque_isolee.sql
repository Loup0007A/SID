-- =====================================================================
-- 0129 — Lot 101 : banque isolée. Rejouable. À lancer après 0128.
--
-- Une banque à part, hors de l'économie du S.I.D. : son argent ne compte
-- pas dans la masse monétaire, ne rapporte pas d'intérêts, n'est ni taxé,
-- ni saisi (impôts, faillites, absences), ni visé par les farces.
--
-- Un seul directeur, un fondateur désigné depuis l'éditeur SQL de
-- Supabase (jamais depuis le site) :
--   select public.banque_isolee_designer_directeur('Pseudo');
--
-- Le directeur donne l'accès à un membre, règle les plafonds et décide des
-- retraits. L'argent circule seulement avec l'épargne (bank_accounts) :
--   - dépôt : de l'épargne vers la banque isolée, immédiat ;
--   - retrait : 1. le membre demande, 2. il confirme en retapant le
--     montant (15 min au plus), 3. le directeur accepte, 4. 48 h d'attente
--     pendant lesquelles le directeur peut encore bloquer, 5. versement
--     sur l'épargne. Plafond sur 7 jours glissants (par défaut ou propre au
--     membre). La somme est mise de côté dès la confirmation.
-- Retrait de l'accès : les demandes en cours sont annulées, puis le solde
-- est soit détruit, soit renvoyé sur l'épargne (le directeur retape le
-- pseudo du membre pour confirmer).
--
-- Réforme monétaire : si un directeur existe, aucune réforme ne s'applique
-- sans sa validation, en plus de la vérification habituelle. C'est lui qui
-- décide, réforme par réforme, si la banque isolée est convertie aussi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables (lisibles seulement par les fonctions ci-dessous)
-- ---------------------------------------------------------------------
create table if not exists public.banque_isolee_reglages (
  id boolean primary key default true check (id),
  directeur_id uuid references public.profiles (id) on delete set null,
  plafond_hebdo numeric(18, 2) not null default 1000 check (plafond_hebdo >= 0),
  updated_at timestamptz not null default now()
);
insert into public.banque_isolee_reglages (id) values (true) on conflict (id) do nothing;

create table if not exists public.banque_isolee_comptes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  actif boolean not null default true,
  solde numeric(18, 2) not null default 0 check (solde >= 0),
  plafond_hebdo numeric(18, 2) check (plafond_hebdo is null or plafond_hebdo >= 0),
  accorde_par uuid references public.profiles (id) on delete set null,
  accorde_le timestamptz not null default now(),
  retire_le timestamptz,
  retire_mode text check (retire_mode is null or retire_mode in ('detruire', 'renvoyer')),
  updated_at timestamptz not null default now()
);

create table if not exists public.banque_isolee_retraits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  montant numeric(18, 2) not null check (montant > 0),
  statut text not null default 'a_confirmer'
    check (statut in ('a_confirmer', 'demande', 'accepte', 'verse', 'refuse', 'annule', 'expire')),
  cree_le timestamptz not null default now(),
  confirme_le timestamptz,
  decide_le timestamptz,
  decide_par uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  versable_le timestamptz,
  verse_le timestamptz
);
create index if not exists banque_isolee_retraits_user_idx on public.banque_isolee_retraits (user_id, cree_le desc);
create index if not exists banque_isolee_retraits_ouverts_idx on public.banque_isolee_retraits (statut, versable_le)
  where statut in ('a_confirmer', 'demande', 'accepte');

create table if not exists public.banque_isolee_mouvements (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('acces_donne', 'depot', 'retrait_mis_de_cote', 'retrait_rendu', 'retrait_verse',
                                     'acces_retire_detruit', 'acces_retire_renvoye', 'reforme', 'plafond')),
  montant numeric(18, 2) not null default 0,
  solde_apres numeric(18, 2),
  par uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists banque_isolee_mouvements_user_idx on public.banque_isolee_mouvements (user_id, at desc);

alter table public.banque_isolee_reglages enable row level security;
alter table public.banque_isolee_comptes enable row level security;
alter table public.banque_isolee_retraits enable row level security;
alter table public.banque_isolee_mouvements enable row level security;
revoke all on public.banque_isolee_reglages, public.banque_isolee_comptes, public.banque_isolee_retraits,
              public.banque_isolee_mouvements from public, anon, authenticated;

-- Notifications de la banque isolée : toujours envoyées (non réglables).
do $$
declare
  v_def text;
  v_list text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  v_list := string_to_array((regexp_match(v_def, '\{([^}]*)\}'))[1], ',');
  if not 'banque' = any (v_list) then
    v_list := v_list || 'banque'::text;
    alter table public.notifications drop constraint notifications_type_check;
    execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_list);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Outils
-- ---------------------------------------------------------------------
create or replace function public._banque_directeur_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select r.directeur_id from public.banque_isolee_reglages r
  join public.profiles p on p.id = r.directeur_id and p.is_founder
  where r.id;
$$;

-- Le directeur, et lui seul (fondateur, ni compte de test, ni gelé).
create or replace function public._banque_directeur()
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or v_uid is distinct from public._banque_directeur_id()
     or public.is_sandbox_account(v_uid)
     or coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Réservé au directeur de la banque isolée.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function public._banque_montant(p numeric)
returns numeric
language plpgsql immutable
as $$
begin
  if p is null or p <= 0 or p > 1000000000000 then raise exception 'Montant invalide.'; end if;
  if round(p, 2) <> p then raise exception 'Deux décimales au plus.'; end if;
  return p;
end;
$$;

create or replace function public._banque_plafond(p_user uuid)
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce((select plafond_hebdo from public.banque_isolee_comptes where user_id = p_user),
                  (select plafond_hebdo from public.banque_isolee_reglages where id));
$$;

-- Retraits engagés sur 7 jours glissants (confirmés, hors refus et annulations).
create or replace function public._banque_utilise_7j(p_user uuid)
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(montant), 0) from public.banque_isolee_retraits
  where user_id = p_user and statut in ('demande', 'accepte', 'verse') and confirme_le > now() - interval '7 days';
$$;

create or replace function public._banque_noter(p_user uuid, p_kind text, p_montant numeric, p_solde numeric, p_par uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public
as $$
  insert into public.banque_isolee_mouvements (user_id, kind, montant, solde_apres, par, details)
  values (p_user, p_kind, coalesce(p_montant, 0), p_solde, p_par, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public._banque_notifier(p_user uuid, p_title text, p_body text, p_link text default '/dashboard/bank#banque-isolee')
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, 'banque', p_title, p_body, p_link where p_user is not null;
$$;

create or replace function public._banque_z(n numeric)
returns text
language sql immutable
as $$
  select replace(regexp_replace(to_char(round(n, 2), 'FM999999999999990.00'), '\.00$', ''), '.', ',') || ' z';
$$;

-- Crédite l'épargne (comme un dépôt : relance le décompte des intérêts).
create or replace function public._banque_vers_epargne(p_user uuid, p_montant numeric)
returns void
language sql security definer set search_path = public
as $$
  insert into public.bank_accounts (user_id, balance, last_interest_at)
  values (p_user, p_montant, now())
  on conflict (user_id) do update
    set balance = public.bank_accounts.balance + excluded.balance, last_interest_at = now();
$$;

-- ---------------------------------------------------------------------
-- 3. Désignation du directeur (éditeur SQL de Supabase seulement)
-- ---------------------------------------------------------------------
create or replace function public.banque_isolee_designer_directeur(p_pseudo text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_nick text;
begin
  if p_pseudo is null then
    update public.banque_isolee_reglages set directeur_id = null, updated_at = now() where id;
    return 'Plus de directeur : la banque isolée est fermée à toute décision.';
  end if;
  select id, nickname into v_id, v_nick from public.profiles
  where lower(nickname) = lower(trim(p_pseudo)) and is_founder;
  if v_id is null then raise exception 'Aucun fondateur avec ce pseudo.'; end if;
  update public.banque_isolee_reglages set directeur_id = v_id, updated_at = now() where id;
  return 'Directeur de la banque isolée : ' || v_nick;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Direction : accès, plafonds
-- ---------------------------------------------------------------------
create or replace function public.banque_isolee_donner_acces(p_user uuid, p_plafond numeric default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
  c public.banque_isolee_comptes;
begin
  if p_plafond is not null and (p_plafond < 0 or p_plafond > 1000000000000) then raise exception 'Plafond invalide.'; end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then
    raise exception 'Membre introuvable ou inactif.';
  end if;
  if public.is_sandbox_account(p_user) then raise exception 'Pas de banque isolée pour un compte de test.'; end if;
  select * into c from public.banque_isolee_comptes where user_id = p_user for update;
  if c.user_id is not null and c.actif then raise exception 'Ce membre a déjà accès à la banque isolée.'; end if;
  if c.user_id is null then
    insert into public.banque_isolee_comptes (user_id, plafond_hebdo, accorde_par)
    values (p_user, round(p_plafond, 2), v_dir);
  else
    update public.banque_isolee_comptes
    set actif = true, solde = 0, plafond_hebdo = round(p_plafond, 2), accorde_par = v_dir, accorde_le = now(),
        retire_le = null, retire_mode = null, updated_at = now()
    where user_id = p_user;
  end if;
  perform public._banque_noter(p_user, 'acces_donne', 0, 0, v_dir, jsonb_build_object('plafond', p_plafond));
  perform public._banque_notifier(p_user, 'Accès à la banque isolée',
    'Tu peux maintenant mettre de l''argent de ton épargne à l''abri dans la banque isolée. Les retraits passent par plusieurs vérifications.');
  perform public._journal_noter(p_user, 'equipe', 'Accès à la banque isolée donné', jsonb_build_object('par', 'equipe'));
end;
$$;

-- p_user null : plafond par défaut. Sinon plafond propre au membre
-- (p_plafond null : il revient au plafond par défaut).
create or replace function public.banque_isolee_regler_plafond(p_user uuid, p_plafond numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
  v_solde numeric;
begin
  if p_plafond is not null and (p_plafond < 0 or p_plafond > 1000000000000) then raise exception 'Plafond invalide.'; end if;
  if p_user is null then
    if p_plafond is null then raise exception 'Indique le plafond par défaut.'; end if;
    update public.banque_isolee_reglages set plafond_hebdo = round(p_plafond, 2), updated_at = now() where id;
    return;
  end if;
  update public.banque_isolee_comptes set plafond_hebdo = round(p_plafond, 2), updated_at = now()
  where user_id = p_user and actif
  returning solde into v_solde;
  if v_solde is null then raise exception 'Ce membre n''a pas accès à la banque isolée.'; end if;
  perform public._banque_noter(p_user, 'plafond', 0, v_solde, v_dir, jsonb_build_object('plafond', p_plafond));
end;
$$;

-- Retrait de l'accès. p_confirmation : le pseudo du membre, retapé.
create or replace function public.banque_isolee_retirer_acces(p_user uuid, p_mode text, p_confirmation text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
  c public.banque_isolee_comptes;
  v_nick text;
  v_rendu numeric;
  v_solde numeric;
begin
  if p_mode not in ('detruire', 'renvoyer') then raise exception 'Choisis : détruire ou renvoyer sur l''épargne.'; end if;
  select nickname into v_nick from public.profiles where id = p_user;
  if v_nick is null or p_confirmation is null or lower(trim(p_confirmation)) <> lower(v_nick) then
    raise exception 'Retape exactement le pseudo du membre pour confirmer.';
  end if;
  select * into c from public.banque_isolee_comptes where user_id = p_user for update;
  if c.user_id is null or not c.actif then raise exception 'Ce membre n''a pas accès à la banque isolée.'; end if;

  -- Demandes en cours : annulées, sommes mises de côté rendues au solde.
  select coalesce(sum(montant), 0) into v_rendu from public.banque_isolee_retraits
  where user_id = p_user and statut in ('demande', 'accepte');
  update public.banque_isolee_retraits
  set statut = 'annule', decide_le = now(), decide_par = v_dir, note = 'Accès à la banque isolée retiré.'
  where user_id = p_user and statut in ('a_confirmer', 'demande', 'accepte');
  v_solde := c.solde + v_rendu;

  if p_mode = 'renvoyer' and v_solde > 0 then
    perform public._banque_vers_epargne(p_user, v_solde);
  end if;
  update public.banque_isolee_comptes
  set actif = false, solde = 0, retire_le = now(), retire_mode = p_mode, updated_at = now()
  where user_id = p_user;
  perform public._banque_noter(p_user, case p_mode when 'detruire' then 'acces_retire_detruit' else 'acces_retire_renvoye' end,
                               -v_solde, 0, v_dir);
  perform public._banque_notifier(p_user, 'Accès à la banque isolée retiré',
    case p_mode when 'detruire' then 'Le solde de ta banque isolée (' || public._banque_z(v_solde) || ') a été détruit.'
                else 'Le solde de ta banque isolée (' || public._banque_z(v_solde) || ') a été versé sur ton épargne.' end);
  perform public._journal_noter(p_user, 'equipe', 'Accès à la banque isolée retiré', jsonb_build_object('par', 'equipe'));
  return jsonb_build_object('mode', p_mode, 'montant', v_solde);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Membre : dépôt et demande de retrait
-- ---------------------------------------------------------------------
create or replace function public._banque_membre()
returns public.banque_isolee_comptes
language plpgsql security definer set search_path = public
as $$
declare
  c public.banque_isolee_comptes;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if coalesce((select is_frozen from public.profiles where id = auth.uid()), false) then
    raise exception 'Ton compte est gelé.';
  end if;
  select * into c from public.banque_isolee_comptes where user_id = auth.uid() and actif for update;
  if c.user_id is null then raise exception 'Tu n''as pas accès à la banque isolée.' using errcode = '42501'; end if;
  return c;
end;
$$;

create or replace function public.banque_isolee_deposer(p_montant numeric)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  c public.banque_isolee_comptes := public._banque_membre();
  v_m numeric := public._banque_montant(p_montant);
  v_epargne numeric;
begin
  select balance into v_epargne from public.bank_accounts where user_id = c.user_id for update;
  if coalesce(v_epargne, 0) < v_m then raise exception 'Épargne insuffisante.'; end if;
  update public.bank_accounts set balance = balance - v_m where user_id = c.user_id;
  update public.banque_isolee_comptes set solde = solde + v_m, updated_at = now() where user_id = c.user_id;
  perform public._banque_noter(c.user_id, 'depot', v_m, c.solde + v_m, c.user_id);
  return c.solde + v_m;
end;
$$;

-- Étape 1 : la demande (rien n'est mis de côté avant la confirmation).
create or replace function public.banque_isolee_retrait_demander(p_montant numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c public.banque_isolee_comptes := public._banque_membre();
  v_m numeric := public._banque_montant(p_montant);
  v_plafond numeric := public._banque_plafond(c.user_id);
  v_utilise numeric := public._banque_utilise_7j(c.user_id);
  v_id uuid;
begin
  if c.solde < v_m then raise exception 'Solde insuffisant dans la banque isolée.'; end if;
  if v_utilise + v_m > v_plafond then
    raise exception 'Plafond sur 7 jours dépassé : % déjà engagés sur %.', public._banque_z(v_utilise), public._banque_z(v_plafond);
  end if;
  if (select count(*) from public.banque_isolee_retraits where user_id = c.user_id and statut = 'demande') >= 3 then
    raise exception 'Trois demandes attendent déjà la décision du directeur.';
  end if;
  update public.banque_isolee_retraits set statut = 'expire'
  where user_id = c.user_id and statut = 'a_confirmer';
  insert into public.banque_isolee_retraits (user_id, montant) values (c.user_id, v_m) returning id into v_id;
  return jsonb_build_object('id', v_id, 'montant', v_m, 'expire_le', now() + interval '15 minutes');
end;
$$;

-- Étape 2 : confirmation, montant retapé. La somme est mise de côté.
create or replace function public.banque_isolee_retrait_confirmer(p_id uuid, p_montant_retape numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c public.banque_isolee_comptes := public._banque_membre();
  r public.banque_isolee_retraits;
  v_plafond numeric := public._banque_plafond(c.user_id);
  v_utilise numeric := public._banque_utilise_7j(c.user_id);
  v_nick text;
begin
  select * into r from public.banque_isolee_retraits where id = p_id and user_id = c.user_id for update;
  if r.id is null or r.statut <> 'a_confirmer' then raise exception 'Demande introuvable ou déjà confirmée.'; end if;
  if r.cree_le < now() - interval '15 minutes' then
    update public.banque_isolee_retraits set statut = 'expire' where id = r.id;
    raise exception 'Demande expirée (15 minutes) : recommence.';
  end if;
  if p_montant_retape is null or p_montant_retape <> r.montant then
    raise exception 'Le montant retapé ne correspond pas à la demande.';
  end if;
  if c.solde < r.montant then raise exception 'Solde insuffisant dans la banque isolée.'; end if;
  if v_utilise + r.montant > v_plafond then
    raise exception 'Plafond sur 7 jours dépassé : % déjà engagés sur %.', public._banque_z(v_utilise), public._banque_z(v_plafond);
  end if;

  update public.banque_isolee_comptes set solde = solde - r.montant, updated_at = now() where user_id = c.user_id;
  update public.banque_isolee_retraits set statut = 'demande', confirme_le = now() where id = r.id;
  perform public._banque_noter(c.user_id, 'retrait_mis_de_cote', -r.montant, c.solde - r.montant, c.user_id, jsonb_build_object('retrait', r.id));
  select nickname into v_nick from public.profiles where id = c.user_id;
  perform public._banque_notifier(public._banque_directeur_id(), 'Retrait à décider (banque isolée)',
    coalesce(v_nick, 'Un membre') || ' demande ' || public._banque_z(r.montant) || '.', '/dashboard/admin/banque-isolee');
end;
$$;

-- Le membre peut annuler tant que l'argent n'est pas versé.
create or replace function public.banque_isolee_retrait_annuler(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.banque_isolee_retraits;
  v_solde numeric;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select * into r from public.banque_isolee_retraits where id = p_id and user_id = auth.uid() for update;
  if r.id is null or r.statut not in ('a_confirmer', 'demande', 'accepte') then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  update public.banque_isolee_retraits set statut = 'annule', decide_le = now(), decide_par = auth.uid() where id = r.id;
  if r.statut in ('demande', 'accepte') then
    update public.banque_isolee_comptes set solde = solde + r.montant, updated_at = now()
    where user_id = r.user_id returning solde into v_solde;
    perform public._banque_noter(r.user_id, 'retrait_rendu', r.montant, v_solde, auth.uid(), jsonb_build_object('retrait', r.id, 'motif', 'annulé par toi'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Direction : décisions sur les retraits
-- ---------------------------------------------------------------------
-- Accepter : versement dans 48 h. Refuser (note obligatoire) : somme rendue.
create or replace function public.banque_isolee_retrait_decider(p_id uuid, p_accepter boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  r public.banque_isolee_retraits;
  v_solde numeric;
begin
  if v_note is not null and char_length(v_note) > 500 then raise exception 'La note est limitée à 500 caractères.'; end if;
  select * into r from public.banque_isolee_retraits where id = p_id for update;
  if r.id is null or r.statut <> 'demande' then raise exception 'Cette demande n''attend pas de décision.'; end if;
  if not exists (select 1 from public.banque_isolee_comptes where user_id = r.user_id and actif) then
    raise exception 'Ce membre n''a plus accès à la banque isolée.';
  end if;
  if coalesce(p_accepter, false) then
    update public.banque_isolee_retraits
    set statut = 'accepte', decide_le = now(), decide_par = v_dir, note = v_note, versable_le = now() + interval '48 hours'
    where id = r.id;
    perform public._banque_notifier(r.user_id, 'Retrait accepté (banque isolée)',
      public._banque_z(r.montant) || ' arriveront sur ton épargne dans 48 h.');
  else
    if v_note is null then raise exception 'Explique le refus.'; end if;
    update public.banque_isolee_retraits set statut = 'refuse', decide_le = now(), decide_par = v_dir, note = v_note where id = r.id;
    update public.banque_isolee_comptes set solde = solde + r.montant, updated_at = now()
    where user_id = r.user_id returning solde into v_solde;
    perform public._banque_noter(r.user_id, 'retrait_rendu', r.montant, v_solde, v_dir, jsonb_build_object('retrait', r.id, 'motif', v_note));
    perform public._banque_notifier(r.user_id, 'Retrait refusé (banque isolée)', public._banque_z(r.montant) || ' : « ' || v_note || ' ». La somme reste dans la banque isolée.');
  end if;
end;
$$;

-- Bloquer un retrait accepté pendant les 48 h d'attente.
create or replace function public.banque_isolee_retrait_bloquer(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  r public.banque_isolee_retraits;
  v_solde numeric;
begin
  if v_note is null then raise exception 'Explique pourquoi tu bloques ce retrait.'; end if;
  if char_length(v_note) > 500 then raise exception 'La note est limitée à 500 caractères.'; end if;
  select * into r from public.banque_isolee_retraits where id = p_id for update;
  if r.id is null or r.statut <> 'accepte' then raise exception 'Ce retrait n''est pas en attente de versement.'; end if;
  update public.banque_isolee_retraits set statut = 'refuse', decide_le = now(), decide_par = v_dir, note = v_note where id = r.id;
  update public.banque_isolee_comptes set solde = solde + r.montant, updated_at = now()
  where user_id = r.user_id returning solde into v_solde;
  perform public._banque_noter(r.user_id, 'retrait_rendu', r.montant, v_solde, v_dir, jsonb_build_object('retrait', r.id, 'motif', v_note));
  perform public._banque_notifier(r.user_id, 'Retrait bloqué (banque isolée)', public._banque_z(r.montant) || ' : « ' || v_note || ' ». La somme reste dans la banque isolée.');
end;
$$;

-- Versements dus (tâches de fond). Un membre gelé attend son dégel.
create or replace function public.banque_isolee_verser_dus()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r public.banque_isolee_retraits;
  n int := 0;
begin
  for r in
    select x.* from public.banque_isolee_retraits x
    join public.banque_isolee_comptes c on c.user_id = x.user_id and c.actif
    join public.profiles p on p.id = x.user_id and not p.is_frozen
    where x.statut = 'accepte' and x.versable_le <= now()
    order by x.versable_le
    limit 200
    for update of x skip locked
  loop
    perform public._banque_vers_epargne(r.user_id, r.montant);
    update public.banque_isolee_retraits set statut = 'verse', verse_le = now() where id = r.id;
    perform public._banque_noter(r.user_id, 'retrait_verse', 0, (select solde from public.banque_isolee_comptes where user_id = r.user_id),
                                 null, jsonb_build_object('retrait', r.id, 'montant', r.montant));
    perform public._banque_notifier(r.user_id, 'Retrait versé (banque isolée)', public._banque_z(r.montant) || ' sont arrivés sur ton épargne.');
    n := n + 1;
  end loop;
  -- Demandes jamais confirmées.
  update public.banque_isolee_retraits set statut = 'expire'
  where statut = 'a_confirmer' and cree_le < now() - interval '15 minutes';
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Lectures
-- ---------------------------------------------------------------------
create or replace function public.banque_isolee_mon_compte()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c public.banque_isolee_comptes;
  v_plafond numeric;
  v_utilise numeric;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select * into c from public.banque_isolee_comptes where user_id = v_uid;
  if c.user_id is null or not c.actif then
    return jsonb_build_object('acces', false, 'directeur', v_uid = public._banque_directeur_id());
  end if;
  v_plafond := public._banque_plafond(v_uid);
  v_utilise := public._banque_utilise_7j(v_uid);
  return jsonb_build_object(
    'acces', true,
    'directeur', v_uid = public._banque_directeur_id(),
    'solde', c.solde,
    'epargne', coalesce((select balance from public.bank_accounts where user_id = v_uid), 0),
    'plafond', v_plafond,
    'utilise_7j', v_utilise,
    'retirable', greatest(least(c.solde, v_plafond - v_utilise), 0),
    'retraits', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'montant', montant, 'statut', statut, 'cree_le', cree_le,
                                          'confirme_le', confirme_le, 'decide_le', decide_le, 'note', note,
                                          'versable_le', versable_le, 'verse_le', verse_le) order by cree_le desc)
      from (select * from public.banque_isolee_retraits where user_id = v_uid and statut <> 'expire' order by cree_le desc limit 20) x), '[]'::jsonb),
    'mouvements', coalesce((
      select jsonb_agg(jsonb_build_object('kind', kind, 'montant', montant, 'solde_apres', solde_apres, 'at', at, 'details', details) order by at desc)
      from (select * from public.banque_isolee_mouvements where user_id = v_uid order by at desc limit 30) m), '[]'::jsonb)
  );
end;
$$;

create or replace function public.banque_isolee_direction()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
begin
  return jsonb_build_object(
    'plafond_defaut', (select plafond_hebdo from public.banque_isolee_reglages where id),
    'total', coalesce((select sum(solde) from public.banque_isolee_comptes where actif), 0)
             + coalesce((select sum(montant) from public.banque_isolee_retraits where statut in ('demande', 'accepte')), 0),
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', c.user_id, 'pseudo', p.nickname, 'avatar', p.avatar_url, 'solde', c.solde,
               'plafond', c.plafond_hebdo, 'plafond_effectif', public._banque_plafond(c.user_id),
               'utilise_7j', public._banque_utilise_7j(c.user_id), 'accorde_le', c.accorde_le, 'gele', p.is_frozen)
             order by lower(p.nickname))
      from public.banque_isolee_comptes c join public.profiles p on p.id = c.user_id where c.actif), '[]'::jsonb),
    'retraits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'user_id', r.user_id, 'pseudo', p.nickname, 'montant', r.montant, 'statut', r.statut,
               'confirme_le', r.confirme_le, 'versable_le', r.versable_le, 'note', r.note,
               'solde', (select solde from public.banque_isolee_comptes where user_id = r.user_id))
             order by case r.statut when 'demande' then 0 else 1 end, r.confirme_le)
      from public.banque_isolee_retraits r join public.profiles p on p.id = r.user_id
      where r.statut in ('demande', 'accepte')), '[]'::jsonb),
    'historique', coalesce((
      select jsonb_agg(jsonb_build_object('pseudo', p.nickname, 'kind', m.kind, 'montant', m.montant, 'at', m.at) order by m.at desc)
      from (select * from public.banque_isolee_mouvements order by at desc limit 40) m join public.profiles p on p.id = m.user_id), '[]'::jsonb),
    'membres', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'pseudo', p.nickname) order by lower(p.nickname))
      from public.profiles p
      where p.status = 'active' and not public.is_sandbox_account(p.id)
        and not exists (select 1 from public.banque_isolee_comptes c where c.user_id = p.id and c.actif)), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Réforme monétaire : validation du directeur
-- ---------------------------------------------------------------------
alter table public.money_reforms add column if not exists banque_isolee_convertir boolean;
alter table public.money_reforms add column if not exists directeur_par uuid references public.profiles (id) on delete set null;
alter table public.money_reforms add column if not exists directeur_le timestamptz;
alter table public.money_reforms add column if not exists directeur_note text check (directeur_note is null or char_length(directeur_note) <= 500);

-- Toute modification d'une réforme annule la validation du directeur ;
-- l'envoi pour vérification le prévient.
create or replace function public._reform_directeur_suivi()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur_id();
begin
  if new.status in ('draft', 'pending', 'rejected') and new.updated_at is distinct from old.updated_at then
    new.directeur_par := null;
    new.directeur_le := null;
    new.banque_isolee_convertir := null;
  end if;
  if new.status = 'pending' and old.status is distinct from 'pending' then
    new.directeur_par := null;
    new.directeur_le := null;
    new.banque_isolee_convertir := null;
    if v_dir is not null then
      perform public._banque_notifier(v_dir, 'Réforme monétaire : ta validation est requise',
        'Réforme n° ' || new.number || ' (' || public._reform_pct(new.factor) || ') : décide si la banque isolée est convertie, puis valide. Rien ne s''applique sans toi.',
        '/dashboard/admin/reforme?reforme=' || new.id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reform_directeur on public.money_reforms;
create trigger trg_reform_directeur before update on public.money_reforms
  for each row execute function public._reform_directeur_suivi();

-- Applique la réforme, puis (si décidé) la conversion de la banque isolée,
-- dans la même transaction. Les membres exclus de la réforme le sont aussi.
create or replace function public._reform_appliquer_complet(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r public.money_reforms;
  v jsonb;
  f numeric;
  m uuid[];
  v_avant numeric;
  v_apres numeric;
  y record;
begin
  select * into r from public.money_reforms where id = p_id;
  v := public._reform_apply(p_id);
  if coalesce(r.banque_isolee_convertir, false) then
    f := r.factor;
    m := public._reform_ids(r.exceptions, 'membre');
    v_avant := coalesce((select sum(solde) from public.banque_isolee_comptes where actif), 0)
               + coalesce((select sum(montant) from public.banque_isolee_retraits where statut in ('demande', 'accepte')), 0);
    for y in
      select user_id, solde, round(solde * f, 2) as nouveau from public.banque_isolee_comptes
      where actif and solde <> 0 and not (user_id = any (m))
    loop
      update public.banque_isolee_comptes set solde = y.nouveau, updated_at = now() where user_id = y.user_id;
      perform public._banque_noter(y.user_id, 'reforme', y.nouveau - y.solde, y.nouveau, auth.uid(), jsonb_build_object('reforme', r.number));
    end loop;
    update public.banque_isolee_retraits set montant = greatest(round(montant * f, 2), 0.01)
    where statut in ('demande', 'accepte') and not (user_id = any (m));
    update public.banque_isolee_comptes set plafond_hebdo = round(plafond_hebdo * f, 2)
    where plafond_hebdo is not null and not (user_id = any (m));
    update public.banque_isolee_reglages set plafond_hebdo = round(plafond_hebdo * f, 2), updated_at = now() where id;
    v_apres := coalesce((select sum(solde) from public.banque_isolee_comptes where actif), 0)
               + coalesce((select sum(montant) from public.banque_isolee_retraits where statut in ('demande', 'accepte')), 0);
  end if;
  update public.money_reforms
  set report = coalesce(report, '{}'::jsonb) || jsonb_build_object('banque_isolee', jsonb_build_object(
        'convertie', coalesce(r.banque_isolee_convertir, false), 'avant', v_avant, 'apres', v_apres))
  where id = p_id;
  return (select to_jsonb(x) from public.money_reforms x where id = p_id);
end;
$$;

-- Vérification (reprise de 0087) : avec un directeur, la réforme attend
-- aussi sa validation ; sinon comme avant.
create or replace function public.reform_review(p_id uuid, p_approve boolean, p_note text default null, p_version timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  r public.money_reforms;
begin
  select * into r from public.money_reforms where id = p_id for update;
  if r.id is null then raise exception 'Réforme introuvable.'; end if;
  if r.status <> 'pending' then raise exception 'Cette réforme n''attend pas de vérification.'; end if;
  if r.reviewed_at is not null and coalesce(p_approve, false) then raise exception 'Cette réforme est déjà vérifiée : elle attend le directeur de la banque isolée.'; end if;
  if p_version is null or date_trunc('milliseconds', p_version) <> date_trunc('milliseconds', r.updated_at) then
    raise exception 'La réforme a été modifiée depuis ton ouverture : relis-la avant de décider.';
  end if;
  if r.created_by = v_uid and exists (select 1 from public._reform_other_admins(v_uid)) then
    raise exception 'Un autre admin « Économie » doit vérifier ta réforme.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'La note est limitée à 500 caractères.'; end if;

  if not coalesce(p_approve, false) then
    if v_note is null then raise exception 'Explique ce qui doit changer.'; end if;
    update public.money_reforms set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note where id = r.id;
    if r.created_by is not null and r.created_by <> v_uid then
      insert into public.notifications (user_id, type, title, body, link)
      values (r.created_by, 'admin_alert', 'Réforme monétaire refusée', v_note, '/dashboard/admin/reforme?reforme=' || r.id);
    end if;
    return (select to_jsonb(x) from public.money_reforms x where id = r.id);
  end if;

  update public.money_reforms set reviewed_by = v_uid, reviewed_at = now(), review_note = v_note where id = r.id;
  if public._banque_directeur_id() is not null and r.directeur_le is null then
    return (select to_jsonb(x) || jsonb_build_object('attente_directeur', true) from public.money_reforms x where id = r.id);
  end if;
  return public._reform_appliquer_complet(r.id);
end;
$$;

-- Décision du directeur. p_version : la date de modification qu'il a lue.
create or replace function public.reform_directeur_decider(p_id uuid, p_valider boolean, p_convertir boolean,
                                                           p_note text default null, p_version timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_dir uuid := public._banque_directeur();
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  r public.money_reforms;
begin
  select * into r from public.money_reforms where id = p_id for update;
  if r.id is null then raise exception 'Réforme introuvable.'; end if;
  if r.status <> 'pending' then raise exception 'Cette réforme n''attend pas de décision.'; end if;
  if r.directeur_le is not null then raise exception 'Tu as déjà validé cette réforme.'; end if;
  if p_version is null or date_trunc('milliseconds', p_version) <> date_trunc('milliseconds', r.updated_at) then
    raise exception 'La réforme a été modifiée depuis ton ouverture : relis-la avant de décider.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'La note est limitée à 500 caractères.'; end if;

  if not coalesce(p_valider, false) then
    if v_note is null then raise exception 'Explique le refus.'; end if;
    update public.money_reforms
    set status = 'rejected', directeur_note = v_note, reviewed_by = v_dir, reviewed_at = now(),
        review_note = 'Refusée par le directeur de la banque isolée : ' || v_note
    where id = r.id;
    if r.created_by is not null and r.created_by <> v_dir then
      insert into public.notifications (user_id, type, title, body, link)
      values (r.created_by, 'admin_alert', 'Réforme monétaire refusée', 'Par le directeur de la banque isolée : ' || v_note, '/dashboard/admin/reforme?reforme=' || r.id);
    end if;
    return (select to_jsonb(x) from public.money_reforms x where id = r.id);
  end if;

  if p_convertir is null then raise exception 'Décide si la banque isolée est convertie.'; end if;
  update public.money_reforms
  set banque_isolee_convertir = p_convertir, directeur_par = v_dir, directeur_le = now(), directeur_note = v_note
  where id = r.id;
  if r.reviewed_at is null then
    return (select to_jsonb(x) || jsonb_build_object('attente_verification', true) from public.money_reforms x where id = r.id);
  end if;
  return public._reform_appliquer_complet(r.id);
end;
$$;

-- Liste (reprise de 0087) avec l'état de la validation du directeur.
create or replace function public.reforms_list()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := public._reform_admin();
  v_alone boolean := not exists (select 1 from public._reform_other_admins(auth.uid()));
  v_dir uuid := public._banque_directeur_id();
begin
  return coalesce((
    select jsonb_agg(to_jsonb(x) || jsonb_build_object(
             'author', (select nickname from public.profiles where id = x.created_by),
             'reviewer', (select nickname from public.profiles where id = x.reviewed_by),
             'directeur', (select nickname from public.profiles where id = coalesce(x.directeur_par, v_dir)),
             'directeur_requis', v_dir is not null,
             'mine', x.created_by = v_uid,
             'can_edit', x.created_by = v_uid and x.status in ('draft', 'pending', 'rejected'),
             'can_review', x.status = 'pending' and x.reviewed_at is null and (x.created_by is distinct from v_uid or v_alone),
             'can_directeur', x.status = 'pending' and x.directeur_le is null and v_dir = v_uid
               and not public.is_sandbox_account(v_uid))
           order by case x.status when 'pending' then 0 when 'draft' then 1 when 'rejected' then 2 else 3 end, x.created_at desc)
    from (select * from public.money_reforms order by created_at desc limit 50) x
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Tâches de fond (reprise de 0125) : versements de la banque isolée
-- ---------------------------------------------------------------------
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

  -- Lot 101 : versements de la banque isolée (après les 48 h).
  begin
    v := v || jsonb_build_object('banque_isolee', public.banque_isolee_verser_dus());
  exception when others then
    v := v || jsonb_build_object('banque_isolee_erreur', sqlerrm);
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
-- 10. Export des données (reprise de 0125) : la banque isolée en plus
-- ---------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_out jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  v_out := public._export_my_data_complet();
  v_out := v_out || jsonb_build_object('banque_isolee', jsonb_build_object(
    'compte', (select to_jsonb(c) - 'accorde_par' from public.banque_isolee_comptes c where user_id = auth.uid()),
    'retraits', coalesce((select jsonb_agg(to_jsonb(r) - 'decide_par' order by cree_le) from public.banque_isolee_retraits r where user_id = auth.uid()), '[]'::jsonb),
    'mouvements', coalesce((select jsonb_agg(to_jsonb(m) - 'par' order by at) from public.banque_isolee_mouvements m where user_id = auth.uid()), '[]'::jsonb)));
  perform public._journal_noter(auth.uid(), 'export', 'Export de tes données', jsonb_build_object('par', 'toi'));
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._banque_directeur_id()', 'public._banque_directeur()', 'public._banque_montant(numeric)',
    'public._banque_plafond(uuid)', 'public._banque_utilise_7j(uuid)',
    'public._banque_noter(uuid, text, numeric, numeric, uuid, jsonb)', 'public._banque_notifier(uuid, text, text, text)',
    'public._banque_z(numeric)', 'public._banque_vers_epargne(uuid, numeric)', 'public._banque_membre()',
    'public.banque_isolee_designer_directeur(text)', 'public.banque_isolee_verser_dus()',
    'public._reform_directeur_suivi()', 'public._reform_appliquer_complet(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- Désignation : jamais par une clé du site, même la clé « service ».
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on function public.banque_isolee_designer_directeur(text) from service_role;
  end if;
  foreach f in array array[
    'public.banque_isolee_donner_acces(uuid, numeric)', 'public.banque_isolee_regler_plafond(uuid, numeric)',
    'public.banque_isolee_retirer_acces(uuid, text, text)', 'public.banque_isolee_deposer(numeric)',
    'public.banque_isolee_retrait_demander(numeric)', 'public.banque_isolee_retrait_confirmer(uuid, numeric)',
    'public.banque_isolee_retrait_annuler(uuid)', 'public.banque_isolee_retrait_decider(uuid, boolean, text)',
    'public.banque_isolee_retrait_bloquer(uuid, text)', 'public.banque_isolee_mon_compte()', 'public.banque_isolee_direction()',
    'public.reform_review(uuid, boolean, text, timestamptz)', 'public.reform_directeur_decider(uuid, boolean, boolean, text, timestamptz)',
    'public.reforms_list()', 'public.export_my_data()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. Correctif relevé par l'audit : les styles de fiche (0042) étaient
-- lisibles sans session. Le site ne les lit que connecté.
-- ---------------------------------------------------------------------
drop policy if exists "profile_styles_select_all" on public.profile_styles;
create policy "profile_styles_select_all" on public.profile_styles for select to authenticated using (true);
revoke all on public.profile_styles from anon;
