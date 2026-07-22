-- =========================================================
-- Correctif : list_roster() (et get_visible_profile()) retournaient NULL
-- pour un profil dont hidden_fields est vide (cas par défaut !) à cause
-- d'un `SELECT ... INTO` sur un unnest() qui ne renvoie aucune ligne quand
-- le tableau est vide. En PL/pgSQL, `SELECT INTO` sans ligne met la
-- variable à NULL. On utilise l'opérateur jsonb - text[] à la place, qui
-- gère nativement un tableau vide sans rien casser.
-- =========================================================

create or replace function public.get_visible_profile(target uuid, viewer uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  p public.profiles;
  result jsonb;
  can_see_all boolean;
begin
  select * into p from public.profiles where id = target;
  if p.id is null then
    return null;
  end if;

  can_see_all := (viewer = target) or public.has_permission(viewer, 'manage_users');

  result := to_jsonb(p);

  if not can_see_all then
    result := result - p.hidden_fields;
  end if;

  return result;
end;
$$;

create or replace function public.list_roster()
returns setof jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  r public.profiles;
  can_see_all boolean;
  result jsonb;
begin
  for r in select * from public.profiles where status = 'active' order by nickname loop
    can_see_all := (r.id = auth.uid()) or public.has_permission(auth.uid(), 'manage_users');
    result := to_jsonb(r);
    if not can_see_all then
      result := result - r.hidden_fields;
    end if;
    return next result;
  end loop;
end;
$$;

-- =========================================================
-- Rôles visibles publiquement sur le trombinoscope ("rang" des membres)
-- =========================================================
create or replace function public.list_member_roles()
returns table(user_id uuid, role_name text, role_color text, role_rank int)
language sql
stable
security definer set search_path = public
as $$
  select ur.user_id, r.name, r.color, r.rank
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id and p.status = 'active'
  order by r.rank desc;
$$;

-- =========================================================
-- Résumé des achats d'un membre (pour affichage sur son propre profil)
-- =========================================================
create or replace function public.list_my_purchases()
returns table(item_name text, quantity bigint, last_purchase timestamptz)
language sql
stable
security definer set search_path = public
as $$
  select si.name, sum(p.quantity)::bigint, max(p.created_at)
  from public.purchases p
  join public.shop_items si on si.id = p.item_id
  where p.user_id = auth.uid()
  group by si.name
  order by max(p.created_at) desc;
$$;
