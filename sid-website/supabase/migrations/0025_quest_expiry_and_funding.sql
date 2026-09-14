-- =========================================================
-- 1) Financement des quêtes : par défaut, c'est le CRÉATEUR de la quête qui
--    débourse la récompense de sa poche (comme une "prime" personnelle),
--    sauf s'il précise explicitement que la quête est financée autrement
--    (funded_by_creator = false → la récompense est créée "par la banque",
--    comportement historique du site).
--
-- 2) Expiration automatique : à l'échéance (deadline dépassée), si le
--    nombre de participants requis (max_participants) est atteint, la
--    quête est automatiquement validée pour tout le monde et clôturée.
--    Avec une marge (1 place manquante, ex. 9/10) : on ne clôture pas
--    automatiquement, on demande confirmation au créateur de la quête. En
--    dessous de cette marge : la quête expire simplement en "échec", sans
--    paiement.
--
-- Comme pour les salaires (voir 0019), le déclenchement se fait à la
-- consultation du panneau des quêtes plutôt que via un job planifié
-- (pg_cron) — process_expired_quests() est appelée par le site à chaque
-- chargement de /dashboard/quests, pas de dépendance à une extension.
--
-- Important : SECURITY DEFINER change les droits d'accès aux TABLES, mais
-- PAS la valeur de auth.uid() (toujours celle de l'utilisateur réellement
-- connecté). Un appel imbriqué à une fonction qui vérifie
-- has_permission(auth.uid(), ...) échouerait donc si c'est un membre lambda
-- qui a simplement chargé la page et déclenché le traitement automatique.
-- On sépare donc la logique de paiement (do_validate_quest_all_participants,
-- sans vérification de permission) de ses points d'entrée protégés.
-- =========================================================

alter table public.quests add column funded_by_creator boolean not null default true;
alter table public.quests add column pending_expiry_confirmation boolean not null default false;

comment on column public.quests.funded_by_creator is
  'Si true (défaut), la récompense est prélevée sur le portefeuille du créateur de la quête à chaque validation. Si false, elle est créée directement (comportement historique).';

-- ---------------------------------------------------------
-- validate_quest_participant : version protégée (manage_quests), avec
-- prélèvement chez le créateur si funded_by_creator.
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
end;
$$;

-- ---------------------------------------------------------
-- Logique de paiement groupé, SANS vérification de permission : réservée
-- aux appels internes depuis des fonctions qui ont déjà validé
-- elles-mêmes qui a le droit d'agir (voir ci-dessous).
-- ---------------------------------------------------------

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

    v_count := v_count + 1;
  end loop;

  update public.quests
    set status = 'completed', pending_expiry_confirmation = false
    where id = p_quest_id;

  return v_count;
end;
$$;

-- Point d'entrée protégé (bouton "Tout valider" côté managers).
create or replace function public.validate_quest_all_participants(p_quest_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  return public.do_validate_quest_all_participants(p_quest_id, auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- Traite les quêtes expirées (deadline dépassée, encore "open"/"in_progress").
-- Pas de vérification de permission : n'importe quel membre connecté peut
-- déclencher ce contrôle (c'est un simple constat d'échéance, comme
-- check_and_pay_my_salary), la fonction interne gère elle-même qui est payé.
-- Marge fixée à 1 place manquante (ex : 9/10 déclenche la confirmation du
-- créateur plutôt qu'une clôture automatique). Ne concerne que les quêtes
-- avec un nombre de places défini (max_participants) : sans objectif chiffré,
-- il n'y a rien à "atteindre" automatiquement, les managers gèrent à la main.
-- ---------------------------------------------------------

create or replace function public.process_expired_quests()
returns int
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
      and max_participants is not null
      and not pending_expiry_confirmation
    for update
  loop
    select count(*) into v_count from public.quest_participants where quest_id = r.id;

    if v_count >= r.max_participants then
      -- Objectif atteint : validation automatique de tout le monde.
      perform public.do_validate_quest_all_participants(r.id, r.created_by);
    elsif v_count >= (r.max_participants - v_margin) then
      -- Proche de l'objectif (marge) : on laisse la décision au créateur.
      update public.quests set pending_expiry_confirmation = true where id = r.id;
    else
      -- Trop loin de l'objectif : échec, pas de paiement.
      update public.quests set status = 'failed' where id = r.id;
    end if;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

-- Décision du créateur (ou d'un manager) sur une quête "proche" de son
-- objectif à l'expiration.
create or replace function public.confirm_expired_quest(p_quest_id uuid, p_confirm boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
begin
  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  if not (
    v_quest.created_by = auth.uid()
    or public.has_permission(auth.uid(), 'manage_quests')
  ) then
    raise exception 'Permission refusée';
  end if;

  if not v_quest.pending_expiry_confirmation then
    raise exception 'Cette quête n''attend pas de confirmation.';
  end if;

  if p_confirm then
    perform public.do_validate_quest_all_participants(p_quest_id, auth.uid());
  else
    update public.quests
      set status = 'failed', pending_expiry_confirmation = false
      where id = p_quest_id;
  end if;
end;
$$;

-- Liste les quêtes en attente de confirmation, visibles par leur créateur
-- ou par un manager.
create or replace function public.list_pending_expiry_quests()
returns setof public.quests
language sql
stable
security definer set search_path = public
as $$
  select * from public.quests
  where pending_expiry_confirmation
    and (created_by = auth.uid() or public.has_permission(auth.uid(), 'manage_quests'));
$$;
