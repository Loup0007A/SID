-- =========================================================
-- Retire la téléportation sur la carte : jusqu'ici, la page Carte
-- permettait de choisir n'importe quel lieu dans un menu déroulant et de
-- "s'y téléporter" instantanément via un simple upsert de
-- `character_positions`. Toute la mécanique de trajet chronométré
-- (start_travel / advance_my_travel, déjà utilisée pour se rendre sur le
-- lieu d'une quête) était donc contournable.
--
-- Désormais :
-- - Un membre choisit son POINT DE DÉPART une seule fois (`set_initial_position`),
--   la première fois qu'il utilise la carte — ce n'est pas un trajet, il n'y
--   a encore nulle part "d'où" partir.
-- - Une fois ce point de départ posé (`spawned = true`), tout changement de
--   LIEU passe obligatoire par `start_travel` (trajet chronométré, comme
--   avant pour les quêtes). `set_initial_position` refuse alors de rejouer.
-- - Bâtiment / note libre / visibilité restent modifiables librement à tout
--   moment (ce ne sont pas des déplacements) via `update_position_prefs`.
-- - Un trigger interdit, en plus, toute modification DIRECTE de
--   place_id/route_id/route_progress/travel_started_at/planned_path/spawned
--   depuis le navigateur (appel API direct sur la table) : seules les
--   fonctions SECURITY DEFINER ci-dessous peuvent les toucher — même
--   protection que celle posée sur `profiles` dans une migration précédente.
--
-- Cette migration suppose (comme 0026_map_integration.sql) que la table
-- `character_positions` existe déjà (créée côté sid-map).
-- =========================================================

alter table public.character_positions add column if not exists spawned boolean not null default false;

-- Rétrocompatibilité : les membres qui avaient déjà une position (posée via
-- l'ancien système, ou déjà arrivés quelque part) ne sont pas obligés de
-- "re-spawn" — on les marque comme déjà partis.
update public.character_positions
  set spawned = true
  where place_id is not null or building_id is not null or note is not null or route_id is not null;

-- ---------------------------------------------------------
-- Point de départ initial (une seule fois, jamais après).
-- ---------------------------------------------------------
create or replace function public.set_initial_position(
  p_place_id uuid,
  p_building_id uuid default null,
  p_note text default null,
  p_is_visible boolean default true
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_already boolean;
begin
  if p_place_id is null then
    raise exception 'Choisis un lieu de départ.';
  end if;

  select spawned into v_already from public.character_positions where user_id = auth.uid();

  if coalesce(v_already, false) then
    raise exception 'Tu as déjà un point de départ : déplace-toi avec un trajet plutôt que de te téléporter.';
  end if;

  insert into public.character_positions (user_id, place_id, building_id, note, is_visible, spawned, updated_at)
  values (auth.uid(), p_place_id, p_building_id, p_note, coalesce(p_is_visible, true), true, now())
  on conflict (user_id) do update
    set place_id = excluded.place_id,
        building_id = excluded.building_id,
        note = excluded.note,
        is_visible = excluded.is_visible,
        spawned = true,
        route_id = null,
        route_progress = null,
        travel_started_at = null,
        planned_path = null,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------
-- Bâtiment / note / visibilité : jamais un déplacement, toujours libre.
-- ---------------------------------------------------------
create or replace function public.update_position_prefs(
  p_building_id uuid default null,
  p_note text default null,
  p_is_visible boolean default true
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.character_positions where user_id = auth.uid() and spawned) then
    raise exception 'Choisis d''abord ton point de départ sur la carte.';
  end if;

  update public.character_positions
    set building_id = p_building_id,
        note = p_note,
        is_visible = coalesce(p_is_visible, true),
        updated_at = now()
    where user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------
-- start_travel : exige désormais un point de départ déjà posé.
-- ---------------------------------------------------------
create or replace function public.start_travel(p_planned_path jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_first jsonb;
  v_spawned boolean;
begin
  select spawned into v_spawned from public.character_positions where user_id = auth.uid();
  if not coalesce(v_spawned, false) then
    raise exception 'Choisis d''abord ton point de départ sur la carte avant de lancer un trajet.';
  end if;

  if p_planned_path is null or jsonb_array_length(p_planned_path) = 0 then
    raise exception 'Trajet vide';
  end if;

  v_first := p_planned_path -> 0;

  update public.character_positions
    set route_id = (v_first->>'route_id')::uuid,
        route_progress = 0,
        travel_started_at = now(),
        planned_path = p_planned_path,
        place_id = null,
        building_id = null,
        updated_at = now()
    where user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------
-- Verrou : interdit toute écriture DIRECTE (hors fonctions ci-dessus) sur
-- les colonnes qui déterminent la position/le trajet. `building_id`,
-- `note`, `is_visible`, `updated_at` restent modifiables directement
-- (inoffensif, pas un déplacement).
-- ---------------------------------------------------------
create or replace function public.protect_character_position_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.place_id is distinct from old.place_id)
     or (new.route_id is distinct from old.route_id)
     or (new.route_progress is distinct from old.route_progress)
     or (new.travel_started_at is distinct from old.travel_started_at)
     or (new.planned_path is distinct from old.planned_path)
     or (new.spawned is distinct from old.spawned) then
    raise exception 'Le lieu ne peut être changé qu''en lançant un trajet (page Carte), jamais directement.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_character_position on public.character_positions;
create trigger trg_protect_character_position
  before update on public.character_positions
  for each row execute function public.protect_character_position_columns();

-- Même verrou à l'insertion directe (hors fonctions SECURITY DEFINER, qui
-- s'exécutent avec les privilèges du propriétaire des fonctions et ne sont
-- donc pas concernées par ce test).
create or replace function public.protect_character_position_insert()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Utilise la page Carte pour poser ton point de départ.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_character_position_insert on public.character_positions;
create trigger trg_protect_character_position_insert
  before insert on public.character_positions
  for each row execute function public.protect_character_position_insert();
