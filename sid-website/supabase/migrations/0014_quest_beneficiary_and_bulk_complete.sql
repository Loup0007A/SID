-- =========================================================
-- Quand un membre prend une quête, il choisit si la récompense lui revient
-- (défaut, `reward_recipient_id` = null) ou revient à quelqu'un d'autre
-- (ex: il agit "pour le compte de" un autre agent). Ajoute aussi la
-- possibilité de valider une quête pour TOUS ses participants d'un coup.
-- =========================================================

alter table public.quest_participants
  add column reward_recipient_id uuid references public.profiles(id);

comment on column public.quest_participants.reward_recipient_id is
  'Si renseigné, la récompense de la quête est versée à ce profil plutôt qu''au participant lui-même.';

-- Remplace validate_quest_participant pour respecter reward_recipient_id
create or replace function public.validate_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_participant public.quest_participants;
  v_recipient uuid;
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  select * into v_participant from public.quest_participants
    where quest_id = p_quest_id and user_id = p_user_id;
  if v_participant.user_id is null then
    raise exception 'Participant introuvable';
  end if;

  v_recipient := coalesce(v_participant.reward_recipient_id, p_user_id);

  update public.quest_participants
    set status = 'validated'
    where quest_id = p_quest_id and user_id = p_user_id;

  update public.wallets set balance = balance + v_quest.reward where user_id = v_recipient;

  insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
  values (v_recipient, v_quest.reward, 'Récompense quête : ' || v_quest.title, p_quest_id, auth.uid());
end;
$$;

-- Valide la quête pour tous les participants non encore validés, et
-- marque la quête comme "completed".
create or replace function public.validate_quest_all_participants(p_quest_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  r record;
  v_recipient uuid;
  v_count int := 0;
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
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
    values (v_recipient, v_quest.reward, 'Récompense quête : ' || v_quest.title, p_quest_id, auth.uid());

    v_count := v_count + 1;
  end loop;

  update public.quests set status = 'completed' where id = p_quest_id;

  return v_count;
end;
$$;

-- Liste les participants d'une quête avec le pseudo du participant et du
-- bénéficiaire de la récompense (utile pour l'écran de gestion des quêtes).
create or replace function public.list_quest_participants(p_quest_id uuid)
returns table (
  user_id uuid,
  nickname text,
  status text,
  reward_recipient_id uuid,
  reward_recipient_nickname text
)
language sql
stable
security definer set search_path = public
as $$
  select
    qp.user_id,
    p.nickname,
    qp.status,
    qp.reward_recipient_id,
    rp.nickname
  from public.quest_participants qp
  join public.profiles p on p.id = qp.user_id
  left join public.profiles rp on rp.id = qp.reward_recipient_id
  where qp.quest_id = p_quest_id
    and (
      public.has_permission(auth.uid(), 'manage_quests')
      or qp.user_id = auth.uid()
      or public.quest_created_by(p_quest_id) = auth.uid()
    );
$$;
