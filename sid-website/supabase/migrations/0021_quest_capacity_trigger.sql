-- =========================================================
-- Corrige le bug qui permettait parfois d'avoir plus de participants que
-- `max_participants` sur une quête. Cause : la vérification du nombre de
-- places se faisait côté client (lire le compteur, puis insérer) — deux
-- personnes cliquant "Prendre la mission" en même temps pouvaient toutes
-- les deux passer la vérification avant que l'insertion de l'une ou
-- l'autre soit prise en compte (race condition classique "check-then-act").
--
-- Solution : un trigger BEFORE INSERT côté base de données, qui verrouille
-- la ligne de la quête (`for update`) avant de compter les participants
-- actuels. Le verrou force les insertions concurrentes à s'exécuter l'une
-- après l'autre, donc la vérification est désormais fiable quel que soit
-- le nombre de clics simultanés — et quel que soit le site qui appelle la
-- base (protection au niveau base, pas au niveau d'un frontend en particulier).
-- =========================================================

create or replace function public.enforce_quest_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
  v_count int;
begin
  select * into v_quest from public.quests where id = new.quest_id for update;

  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  if v_quest.max_participants is not null then
    select count(*) into v_count from public.quest_participants where quest_id = new.quest_id;
    if v_count >= v_quest.max_participants then
      raise exception 'Cette mission est déjà complète.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_quest_capacity on public.quest_participants;

create trigger trg_enforce_quest_capacity
  before insert on public.quest_participants
  for each row execute function public.enforce_quest_capacity();
