-- =====================================================================
-- 0127 — Lot 99 : correctifs de l'audit de sécurité.
--
-- 1. Messagerie : un membre ne peut plus s'ajouter lui-même à une
--    conversation dont il n'est pas le créateur (il pouvait rejoindre et
--    lire n'importe quelle conversation privée dont il connaissait
--    l'identifiant). Une conversation privée (dm) reste à deux.
-- 2. Quêtes : prendre une mission ne permet plus de s'inscrire déjà
--    « validé » ni avec un rapport, ni sur une quête close ou privée.
-- 3. Comptes : admin_peut_gerer_compte(cible) — la gestion des comptes
--    (réinitialiser un mot de passe, confirmer une adresse) ne touche ni un
--    fondateur, ni un autre administrateur, sauf par un fondateur ; jamais
--    depuis un compte de test.
-- 4. Fiches : le recrutement seul ne modifie que les candidatures en
--    attente ; la fiche d'un fondateur ne se modifie que par lui ou un
--    autre fondateur.
-- 5. CSS des fiches : refus des échappements CSS (« u\72l( »), image-set()
--    et src() à l'enregistrement (le nettoyage à l'affichage aussi).
-- 6. Stockage : types et tailles de fichiers limités (avatars, objets,
--    images de la carte).
-- 7. Marché noir : l'étal ne change ni de lieu ni de propriétaire.
-- 8. Messagerie et commentaires de la carte : 40 messages et
--    10 commentaires par minute au plus.
-- Rejouable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Note : les fonctions de déclencheur de ce fichier tournent avec les
-- droits de l'appelant (pas SECURITY DEFINER), pour que current_user
-- distingue un appel direct de l'API d'une écriture faite par le serveur.
-- ---------------------------------------------------------------------
-- 1. Participants d'une conversation
-- ---------------------------------------------------------------------
drop policy if exists chat_participants_insert on public.chat_participants;
create policy chat_participants_insert on public.chat_participants
  for insert to authenticated
  with check (
    not public._chat_is_admin_channel(channel_id)
    and (
      -- Le créateur ajoute les participants (deux au plus pour une conversation privée).
      exists (
        select 1 from public.chat_channels c
        where c.id = chat_participants.channel_id and c.created_by = auth.uid()
          and (c.type <> 'dm' or (select count(*) from public.chat_participants p where p.channel_id = c.id) < 2)
      )
      -- Dans un groupe, un participant ajoute d'autres membres.
      or (
        exists (select 1 from public.chat_channels c where c.id = chat_participants.channel_id and c.type = 'group')
        and public.is_channel_participant(chat_participants.channel_id, auth.uid())
        and user_id <> auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 2. Prendre une mission
-- ---------------------------------------------------------------------
create or replace function public._quest_participant_garde_insert()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_q record;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.has_permission(auth.uid(), 'manage_quests') or public._can_manage_quest(new.quest_id) then
    return new;
  end if;
  select status, visibility into v_q from public.quests where id = new.quest_id;
  if v_q.status is null then raise exception 'Quête introuvable.'; end if;
  if v_q.status <> 'open' then raise exception 'Cette mission n''est plus ouverte.'; end if;
  if v_q.visibility = 'private' then raise exception 'Mission privée : seul son responsable y inscrit des agents.'; end if;
  -- Une inscription commence toujours au début.
  new.status := 'assigned';
  new.joined_at := now();
  new.report := null;
  new.report_at := null;
  new.report_summary := null;
  new.objectives_done := '{}';
  new.report_parts := '{}';
  if new.reward_recipient_id is not null
     and (new.reward_recipient_id = new.user_id
          or not exists (select 1 from public.profiles p where p.id = new.reward_recipient_id and p.status = 'active')) then
    new.reward_recipient_id := null;
  end if;
  return new;
end;
$$;
revoke execute on function public._quest_participant_garde_insert() from public, anon, authenticated;
drop trigger if exists trg_a_quest_participant_garde on public.quest_participants;
create trigger trg_a_quest_participant_garde before insert on public.quest_participants
  for each row execute function public._quest_participant_garde_insert();

-- ---------------------------------------------------------------------
-- 3. Gestion des comptes (routes /api/admin/*)
-- ---------------------------------------------------------------------
create or replace function public.admin_peut_gerer_compte(p_cible uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and p_cible is not null
    and public.has_permission(auth.uid(), 'manage_users')
    and not public.is_sandbox_account(auth.uid())
    and (
      coalesce((select p.is_founder from public.profiles p where p.id = auth.uid()), false)
      or (
        not coalesce((select p.is_founder from public.profiles p where p.id = p_cible), false)
        and not exists (
          select 1 from public.user_roles ur
          join public.role_permissions rp on rp.role_id = ur.role_id
          where ur.user_id = p_cible and rp.permission in ('manage_users', 'manage_roles'))
      )
    );
$$;
revoke execute on function public.admin_peut_gerer_compte(uuid) from public, anon;
grant execute on function public.admin_peut_gerer_compte(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Colonnes protégées des fiches (0120 + recrutement et fondateurs)
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_actor_founder boolean;
begin
  -- Uniquement les appels directs depuis le navigateur / l'API.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  v_is_staff := public.has_permission(v_uid, 'manage_users');
  v_actor_founder := coalesce((select p.is_founder from public.profiles p where p.id = v_uid), false);

  if new.is_founder is distinct from old.is_founder and not v_actor_founder then
    raise exception 'Seul un fondateur peut modifier ce statut.';
  end if;

  -- Lot 99 : la fiche d'un fondateur ne se modifie que par lui ou un fondateur.
  if old.is_founder and v_uid is distinct from new.id and not v_actor_founder then
    raise exception 'Permission refusée : fiche d''un fondateur.';
  end if;

  -- Lot 99 : le recrutement seul ne touche que les candidatures en attente.
  if v_uid is distinct from new.id and not v_is_staff and old.status <> 'pending' then
    raise exception 'Permission refusée : le recrutement ne modifie que les candidatures en attente.';
  end if;

  if (new.power_score is distinct from old.power_score
      or new.reputation is distinct from old.reputation
      or new.member_rank is distinct from old.member_rank
      or new.is_muted is distinct from old.is_muted)
     and not v_is_staff then
    raise exception 'Permission refusée : champ réservé à l''administration.';
  end if;

  if (new.is_frozen is distinct from old.is_frozen
      or new.freeze_until is distinct from old.freeze_until
      or new.mute_until is distinct from old.mute_until
      or new.ban_until is distinct from old.ban_until
      or new.sandbox_expires_at is distinct from old.sandbox_expires_at
      or new.created_at is distinct from old.created_at)
     and not v_is_staff then
    raise exception 'Permission refusée : sanctions et dates réservées à la gestion des comptes.';
  end if;

  if (new.status is distinct from old.status
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at)
     and not (v_is_staff or public.has_permission(v_uid, 'recruit')) then
    raise exception 'Permission refusée : statut du compte.';
  end if;

  if new.is_invisible is distinct from old.is_invisible
     and v_uid is distinct from new.id and not v_is_staff then
    raise exception 'Permission refusée : seul le membre ou la gestion des comptes peut rendre ce compte invisible.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. CSS des fiches : échappements et images distantes refusés
-- ---------------------------------------------------------------------
create or replace function public.set_profile_css(p_section text, p_css text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_css text := coalesce(p_css, '');
  v_hors_textes text;
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_section not in ('org_chart', 'roster', 'leaderboard', 'profile') then
    raise exception 'Section invalide.';
  end if;

  if length(v_css) > 8000 then
    raise exception 'CSS trop long (8000 caractères maximum, actuellement %).', length(v_css);
  end if;

  if v_css ~* '@import|expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:' then
    raise exception 'CSS refusé : construction interdite détectée (@import, expression(), behavior, -moz-binding ou javascript:).';
  end if;

  if v_css ~* 'url\s*\(|image-set\s*\(|(^|[^a-z-])src\s*\(' then
    raise exception 'CSS refusé : url(), image-set() et src() ne sont pas autorisés (ils chargeraient une ressource externe).';
  end if;

  -- Échappements (« \72 », « \l ») : seulement dans les textes entre guillemets.
  v_hors_textes := regexp_replace(v_css, '"([^"\\]|\\.)*"|''([^''\\]|\\.)*''', '', 'g');
  if position('\' in v_hors_textes) > 0 then
    raise exception 'CSS refusé : les échappements (\…) ne sont autorisés que dans les textes entre guillemets.';
  end if;

  insert into public.profile_styles (user_id, section, css, updated_at)
  values (auth.uid(), p_section, v_css, now())
  on conflict (user_id, section) do update
    set css = excluded.css, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Stockage : formats et tailles
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  where id in ('avatars', 'shop-items');
  update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  where id = 'map-images';
end $$;

-- ---------------------------------------------------------------------
-- 7. Étal du marché noir : ni lieu ni propriétaire changés par le joueur
-- ---------------------------------------------------------------------
create or replace function public._etal_garde()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.has_permission(auth.uid(), 'manage_map') then return new; end if;
  if new.place_id is distinct from old.place_id or new.owner_id is distinct from old.owner_id then
    raise exception 'Un étal ne change ni de lieu ni de propriétaire.';
  end if;
  return new;
end;
$$;
revoke execute on function public._etal_garde() from public, anon, authenticated;
drop trigger if exists trg_etal_garde on public.black_market_stalls;
create trigger trg_etal_garde before update on public.black_market_stalls
  for each row execute function public._etal_garde();

-- ---------------------------------------------------------------------
-- 8. Débit des messages et commentaires
-- ---------------------------------------------------------------------
-- Les déclencheurs ci-dessous tournent avec les droits de l'appelant :
-- current_user vaut « authenticated » pour un appel direct de l'API, et le
-- propriétaire des fonctions pour les écritures faites par une fonction
-- du serveur (qui ne sont ni limitées ni bloquées).
create or replace function public._debit(p_cle text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_cle = 'chat' then perform public._limite_debit('chat', 40, 60);
  elsif p_cle = 'commentaires_carte' then perform public._limite_debit('commentaires_carte', 10, 60);
  end if;
end;
$$;
revoke execute on function public._debit(text) from public, anon;
grant execute on function public._debit(text) to authenticated;

create or replace function public._debit_messages()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  perform public._debit(case when tg_table_name = 'chat_messages' then 'chat' else 'commentaires_carte' end);
  return new;
end;
$$;
revoke execute on function public._debit_messages() from public, anon, authenticated;
drop trigger if exists trg_debit_messages on public.chat_messages;
create trigger trg_debit_messages before insert on public.chat_messages
  for each row execute function public._debit_messages();
do $$
begin
  if to_regclass('public.map_comments') is not null then
    drop trigger if exists trg_debit_messages on public.map_comments;
    create trigger trg_debit_messages before insert on public.map_comments
      for each row execute function public._debit_messages();
  end if;
end $$;
