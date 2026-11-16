-- =====================================================================
-- 0100 — Lot 83 : organigramme propre
-- =====================================================================
-- Rejouable. À lancer après 0099.
--
-- Avant : la page écrivait directement dans org_nodes (création et
-- suppression seulement). Supprimer un poste effaçait toute sa branche sans
-- prévenir, un poste ne se modifiait pas, l'ordre n'était pas réglable, et
-- un membre titulaire d'un poste (ou une équipe rattachée) ne pouvait plus
-- être supprimé.
--
-- Maintenant :
-- - lecture par org_chart() : postes, titulaires (pseudo, avatar), équipes.
--   Un titulaire invisible apparaît « Poste vacant » pour les autres
--   membres, comme ailleurs sur le site ;
-- - écriture uniquement par org_node_save(), org_node_move() et
--   org_node_delete() (Gérer l'organigramme), notées au journal d'audit ;
-- - supprimer un poste fait remonter ses sous-postes d'un niveau ;
-- - pas de boucle possible (un poste sous l'un de ses propres sous-postes) ;
-- - membre ou équipe supprimés : le poste reste, vacant ou sans équipe.
-- =====================================================================

alter table public.org_nodes add column if not exists description text;
alter table public.org_nodes add column if not exists updated_at timestamptz not null default now();

-- Titulaire ou équipe supprimés : le poste reste.
alter table public.org_nodes drop constraint if exists org_nodes_holder_id_fkey;
alter table public.org_nodes add constraint org_nodes_holder_id_fkey
  foreign key (holder_id) references public.profiles(id) on delete set null;
alter table public.org_nodes drop constraint if exists org_nodes_group_id_fkey;
alter table public.org_nodes add constraint org_nodes_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete set null;

create index if not exists org_nodes_parent_idx on public.org_nodes (parent_id, sort_order);

-- ---------------------------------------------------------------- Intégrité
create or replace function public.org_nodes_no_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cur uuid := new.parent_id;
  v_steps int := 0;
begin
  while v_cur is not null loop
    if v_cur = new.id then
      raise exception 'Un poste ne peut pas être placé sous lui-même ni sous l''un de ses sous-postes.';
    end if;
    v_steps := v_steps + 1;
    if v_steps > 200 then
      raise exception 'Organigramme trop profond.';
    end if;
    select parent_id into v_cur from public.org_nodes where id = v_cur;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_org_nodes_no_cycle on public.org_nodes;
create trigger trg_org_nodes_no_cycle
  before insert or update of parent_id on public.org_nodes
  for each row execute function public.org_nodes_no_cycle();

-- Ordre 0, 1, 2… parmi les postes d'un même supérieur.
create or replace function public._org_renumber(p_parent uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.org_nodes o
  set sort_order = r.rn
  from (
    select id, (row_number() over (order by sort_order, created_at, id) - 1)::int as rn
    from public.org_nodes
    where parent_id is not distinct from p_parent
  ) r
  where o.id = r.id and o.sort_order <> r.rn;
$$;

revoke execute on function public._org_renumber(uuid) from public, anon, authenticated;

-- Remise en ordre de l'existant.
do $$
declare
  v_parent uuid;
begin
  perform public._org_renumber(null);
  for v_parent in select distinct parent_id from public.org_nodes where parent_id is not null loop
    perform public._org_renumber(v_parent);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- Droits
-- Lecture réservée aux membres connectés ; plus d'écriture directe.
drop policy if exists "org_nodes_select_all" on public.org_nodes;
drop policy if exists "org_nodes_select" on public.org_nodes;
create policy "org_nodes_select" on public.org_nodes for select
  using (auth.uid() is not null);
drop policy if exists "org_nodes_manage" on public.org_nodes;

create or replace function public._org_can_manage()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and public.has_permission(auth.uid(), 'manage_org_chart');
$$;

-- ---------------------------------------------------------------- Lecture
create or replace function public.org_chart()
returns jsonb
language plpgsql stable
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_see_all boolean;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  v_see_all := public.has_permission(v_uid, 'manage_users');
  return jsonb_build_object(
    'can_manage', public._org_can_manage(),
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'parent_id', n.parent_id,
        'label', n.label,
        'description', n.description,
        'sort_order', n.sort_order,
        'holder', case when h.id is not null then jsonb_build_object(
            'id', h.id, 'nickname', h.nickname, 'avatar_url', h.avatar_url) end,
        'group', case when g.id is not null then jsonb_build_object(
            'id', g.id, 'name', g.name, 'independent', g.is_independent_system) end
      ) order by n.sort_order, n.created_at)
      from public.org_nodes n
      left join public.profiles h
        on h.id = n.holder_id
       and h.status = 'active'
       and (v_see_all or h.id = v_uid or not coalesce(h.is_invisible, false))
      left join public.groups g on g.id = n.group_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------- Écriture
-- p_id null : nouveau poste, placé en dernier sous son supérieur.
create or replace function public.org_node_save(
  p_id uuid,
  p_label text,
  p_parent uuid,
  p_holder uuid,
  p_group uuid,
  p_description text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_old public.org_nodes;
  v_id uuid := p_id;
begin
  if not public._org_can_manage() then
    raise exception 'Permission refusée : gestion de l''organigramme requise.';
  end if;
  if v_label = '' then
    raise exception 'Le titre du poste est vide.';
  end if;
  if char_length(v_label) > 60 then
    raise exception 'Titre trop long (60 caractères au plus).';
  end if;
  if char_length(coalesce(v_desc, '')) > 240 then
    raise exception 'Mission trop longue (240 caractères au plus).';
  end if;
  if p_parent is not null and not exists (select 1 from public.org_nodes where id = p_parent) then
    raise exception 'Poste supérieur introuvable.';
  end if;
  if p_holder is not null and not exists (select 1 from public.profiles where id = p_holder and status = 'active') then
    raise exception 'Titulaire introuvable ou compte inactif.';
  end if;
  if p_group is not null and not exists (select 1 from public.groups where id = p_group) then
    raise exception 'Équipe introuvable.';
  end if;

  if v_id is null then
    insert into public.org_nodes (label, description, parent_id, holder_id, group_id, sort_order)
    values (v_label, v_desc, p_parent, p_holder, p_group,
            coalesce((select max(sort_order) + 1 from public.org_nodes where parent_id is not distinct from p_parent), 0))
    returning id into v_id;
    perform public.write_audit('org_node_saved', p_holder,
      jsonb_build_object('poste', v_label, 'nouveau', true), v_label);
    return v_id;
  end if;

  select * into v_old from public.org_nodes where id = v_id;
  if not found then
    raise exception 'Poste introuvable.';
  end if;

  update public.org_nodes
  set label = v_label,
      description = v_desc,
      parent_id = p_parent,
      holder_id = p_holder,
      group_id = p_group,
      sort_order = case when parent_id is distinct from p_parent
                        then coalesce((select max(o.sort_order) + 1 from public.org_nodes o where o.parent_id is not distinct from p_parent), 0)
                        else sort_order end,
      updated_at = now()
  where id = v_id;

  if v_old.parent_id is distinct from p_parent then
    perform public._org_renumber(v_old.parent_id);
  end if;

  perform public.write_audit('org_node_saved', coalesce(p_holder, v_old.holder_id),
    jsonb_strip_nulls(jsonb_build_object(
      'poste', v_label,
      'ancien_titre', case when v_old.label <> v_label then v_old.label end,
      'titulaire_change', case when v_old.holder_id is distinct from p_holder then true end,
      'ancien_titulaire', case when v_old.holder_id is distinct from p_holder
                               then (select nickname from public.profiles where id = v_old.holder_id) end,
      'deplace', case when v_old.parent_id is distinct from p_parent then true end)),
    v_label);
  return v_id;
end;
$$;

-- Monter (-1) ou descendre (+1) parmi les postes du même supérieur.
create or replace function public.org_node_move(p_id uuid, p_dir int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_node public.org_nodes;
  v_other uuid;
begin
  if not public._org_can_manage() then
    raise exception 'Permission refusée : gestion de l''organigramme requise.';
  end if;
  select * into v_node from public.org_nodes where id = p_id;
  if not found then
    raise exception 'Poste introuvable.';
  end if;
  perform public._org_renumber(v_node.parent_id);
  select * into v_node from public.org_nodes where id = p_id;

  select id into v_other from public.org_nodes
  where parent_id is not distinct from v_node.parent_id
    and sort_order = v_node.sort_order + sign(coalesce(p_dir, 0))::int
    and id <> p_id;
  if v_other is null then
    return;
  end if;

  update public.org_nodes set sort_order = v_node.sort_order where id = v_other;
  update public.org_nodes set sort_order = v_node.sort_order + sign(p_dir)::int, updated_at = now() where id = p_id;
end;
$$;

-- Les sous-postes prennent la place du poste supprimé, dans le même ordre.
create or replace function public.org_node_delete(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_node public.org_nodes;
  v_kids int;
begin
  if not public._org_can_manage() then
    raise exception 'Permission refusée : gestion de l''organigramme requise.';
  end if;
  select * into v_node from public.org_nodes where id = p_id;
  if not found then
    raise exception 'Poste introuvable.';
  end if;
  select count(*) into v_kids from public.org_nodes where parent_id = p_id;

  if v_kids > 0 then
    perform public._org_renumber(p_id);
    perform public._org_renumber(v_node.parent_id);
    select * into v_node from public.org_nodes where id = p_id;
    -- Place libre juste après le poste supprimé, puis les sous-postes s'y
    -- glissent.
    update public.org_nodes
    set sort_order = sort_order + v_kids
    where parent_id is not distinct from v_node.parent_id and sort_order > v_node.sort_order;
    update public.org_nodes
    set parent_id = v_node.parent_id,
        sort_order = v_node.sort_order + 1 + sort_order,
        updated_at = now()
    where parent_id = p_id;
  end if;

  delete from public.org_nodes where id = p_id;
  perform public._org_renumber(v_node.parent_id);

  perform public.write_audit('org_node_deleted', v_node.holder_id,
    jsonb_build_object('poste', v_node.label, 'sous_postes_remontes', v_kids), v_node.label);
end;
$$;

revoke execute on function public.org_chart() from public, anon;
revoke execute on function public.org_node_save(uuid, text, uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.org_node_move(uuid, int) from public, anon;
revoke execute on function public.org_node_delete(uuid) from public, anon;
grant execute on function public.org_chart() to authenticated;
grant execute on function public.org_node_save(uuid, text, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.org_node_move(uuid, int) to authenticated;
grant execute on function public.org_node_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
