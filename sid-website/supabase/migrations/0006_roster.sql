-- Trombinoscope : renvoie tous les profils actifs, en retirant à la volée
-- les champs que chacun a choisi de masquer (sauf pour soi-même et le staff
-- disposant de la permission manage_users).
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
      select result - elem into result from unnest(r.hidden_fields) as elem;
    end if;
    return next result;
  end loop;
end;
$$;
