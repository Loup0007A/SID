-- =========================================================
-- Progression des simulations synchronisée entre appareils.
--
-- Les trois sites (Potions, Techniques, 3D-game-world) gardent leur
-- progression dans le localStorage du navigateur : niveaux débloqués,
-- délais entre tentatives, histoires terminées, sauvegardes… Elle ne suivait
-- donc pas le joueur d'un appareil à l'autre.
--
-- Désormais, quand un site est ouvert depuis le S.I.D., le script
-- /sid-sync.js (servi par le S.I.D., chargé par une ligne dans chaque site)
-- recopie ces clés ici, par membre et par simulation, et les remet en place
-- sur n'importe quel autre appareil.
--
-- Identification : par le jeton de partie (sid_run) que le S.I.D. donne à
-- l'iframe, comme pour les résultats. Un jeton reste valable 24 h pour la
-- synchronisation (même si la partie est déjà terminée), et ne donne accès
-- qu'à la progression de SON membre pour SA simulation. Aucun point ne se
-- gagne ici.
--
-- Une clé supprimée sur un appareil est gardée avec la valeur null
-- (« pierre tombale ») pour que sa suppression se propage aux autres
-- appareils au lieu d'être recréée par eux.
--
-- Prérequis : migration 0049 (simulation_runs).
-- =========================================================

do $$
begin
  if to_regclass('public.simulation_runs') is null then
    raise exception 'Applique d''abord la migration 0049_member_stats_simulations.sql.';
  end if;
end;
$$;

create table public.simulation_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('donjons', 'intelligence', 'techniques')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.simulation_progress enable row level security;

-- Chacun peut relire sa propre progression ; aucune écriture directe.
create policy "simulation_progress_select" on public.simulation_progress for select
  using (user_id = auth.uid());

-- Partie (et donc membre + simulation) correspondant à un jeton encore
-- utilisable pour la synchronisation.
create or replace function public.simulation_sync_run(p_token_hash text)
returns public.simulation_runs
language sql
stable
security definer set search_path = public
as $$
  select * from public.simulation_runs
  where token_hash = p_token_hash
    and started_at > now() - interval '24 hours';
$$;

create or replace function public.get_simulation_progress(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_run public.simulation_runs;
  v_row public.simulation_progress;
begin
  v_run := public.simulation_sync_run(p_token_hash);
  if v_run.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into v_row from public.simulation_progress where user_id = v_run.user_id and kind = v_run.kind;

  return jsonb_build_object(
    'result', 'ok',
    'kind', v_run.kind,
    -- Identifiant opaque du membre : permet au script de savoir qu'un autre
    -- membre a joué sur le même appareil.
    'account', md5('sid-sync:' || v_run.user_id::text),
    'data', coalesce(v_row.data, '{}'::jsonb),
    'updated_at', v_row.updated_at
  );
end;
$$;

-- p_set : { "clé": "valeur telle que stockée par le site" }
-- p_remove : clés supprimées sur l'appareil.
create or replace function public.save_simulation_progress(p_token_hash text, p_set jsonb, p_remove text[])
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_run public.simulation_runs;
  v_set jsonb := coalesce(p_set, '{}'::jsonb);
  v_remove text[] := coalesce(p_remove, '{}'::text[]);
  v_tombstones jsonb;
  v_row public.simulation_progress;
begin
  v_run := public.simulation_sync_run(p_token_hash);
  if v_run.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  if jsonb_typeof(v_set) <> 'object' then
    return jsonb_build_object('result', 'invalid', 'message', '« set » doit être un objet.');
  end if;
  if exists (select 1 from jsonb_each(v_set) where jsonb_typeof(value) <> 'string') then
    return jsonb_build_object('result', 'invalid', 'message', 'Les valeurs doivent être des textes.');
  end if;
  if (select count(*) from jsonb_object_keys(v_set)) > 300 or cardinality(v_remove) > 300 then
    return jsonb_build_object('result', 'invalid', 'message', 'Trop de clés en une fois.');
  end if;
  if exists (select 1 from jsonb_object_keys(v_set) k where length(k) > 200)
     or exists (select 1 from unnest(v_remove) k where length(k) > 200) then
    return jsonb_build_object('result', 'invalid', 'message', 'Nom de clé trop long.');
  end if;

  select coalesce(jsonb_object_agg(k, null), '{}'::jsonb) into v_tombstones from unnest(v_remove) as k;

  insert into public.simulation_progress as sp (user_id, kind, data)
  values (v_run.user_id, v_run.kind, v_tombstones || v_set)
  on conflict (user_id, kind) do update
    set data = sp.data || v_tombstones || v_set,
        updated_at = now()
  returning * into v_row;

  if length(v_row.data::text) > 300000 or (select count(*) from jsonb_object_keys(v_row.data)) > 1000 then
    raise exception 'Progression trop volumineuse (300 Ko et 1000 clés maximum).';
  end if;

  return jsonb_build_object('result', 'ok', 'updated_at', v_row.updated_at);
end;
$$;

revoke execute on function public.simulation_sync_run(text) from public, anon, authenticated;
revoke execute on function public.get_simulation_progress(text) from public, anon, authenticated;
revoke execute on function public.save_simulation_progress(text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.get_simulation_progress(text) to service_role;
grant execute on function public.save_simulation_progress(text, jsonb, text[]) to service_role;
