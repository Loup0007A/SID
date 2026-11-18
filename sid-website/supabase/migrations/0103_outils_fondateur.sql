-- =========================================================
-- Lot 86 (1/2) : outils du fondateur.
-- À lancer après 0102. Peut être relancée sans risque.
--
-- * Devlog : journal des nouveautés, lu par tous les membres, écrit par le
--   fondateur seulement.
-- * Recherche dans la base : constructeur de requêtes en lecture seule et
--   recherche d'un texte dans toutes les tables. Réservé au fondateur ;
--   noms de tables et de colonnes vérifiés dans le catalogue, valeurs
--   toujours passées comme littéraux, aucune écriture possible.
-- =========================================================

create or replace function public._is_founder()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_founder);
$$;
revoke execute on function public._is_founder() from public, anon;
grant execute on function public._is_founder() to authenticated;

-- ---------------------------------------------------------
-- 1. Devlog
-- ---------------------------------------------------------
create table if not exists public.devlog_entries (
  id uuid primary key default gen_random_uuid(),
  slug text unique,                         -- pour les entrées créées par migration
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  tag text not null default 'nouveau' check (tag in ('nouveau', 'amelioration', 'correctif', 'economie', 'admin')),
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists devlog_entries_date_idx on public.devlog_entries (published_at desc);
alter table public.devlog_entries enable row level security;
drop policy if exists "devlog_entries_select" on public.devlog_entries;
create policy "devlog_entries_select" on public.devlog_entries for select using (auth.uid() is not null);
-- Aucune policy d'écriture : tout passe par devlog_save / devlog_delete.

create or replace function public.devlog_save(p_id uuid, p_title text, p_body text, p_tag text, p_published_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public._is_founder() then raise exception 'Réservé au fondateur.'; end if;
  if p_id is null then
    insert into public.devlog_entries (title, body, tag, published_at, created_by)
    values (btrim(p_title), coalesce(p_body, ''), coalesce(p_tag, 'nouveau'), coalesce(p_published_at, now()), auth.uid())
    returning id into v_id;
  else
    update public.devlog_entries
       set title = btrim(p_title), body = coalesce(p_body, ''), tag = coalesce(p_tag, tag),
           published_at = coalesce(p_published_at, published_at), updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Entrée introuvable.'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.devlog_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public._is_founder() then raise exception 'Réservé au fondateur.'; end if;
  delete from public.devlog_entries where id = p_id;
end;
$$;

revoke execute on function public.devlog_save(uuid, text, text, text, timestamptz) from public, anon;
revoke execute on function public.devlog_delete(uuid) from public, anon;
grant execute on function public.devlog_save(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.devlog_delete(uuid) to authenticated;

-- Entrées de départ (une fois ; elles se modifient ensuite depuis la page).
insert into public.devlog_entries (slug, title, body, tag, published_at) values
  ('lot-77', 'Marque et noms du site',
   'Le nom du site, de la monnaie et des rubriques se règle depuis l''administration et s''applique partout, sur les trois sites.', 'admin', '2026-11-12 12:00+01'),
  ('lot-79', 'Impôts réservés aux fondateurs',
   'Les impôts hebdomadaires ne concernent plus que les fondateurs.', 'economie', '2026-11-13 12:00+01'),
  ('lot-80', 'Lieu inconnu, chat Admin et élection du Dictateur',
   'Un membre peut disparaître de la carte (« Lieu inconnu »). Le chat Admin réunit l''administration. L''élection du Dictateur a sa cérémonie, réglable dans Modération → Événements.', 'nouveau', '2026-11-14 12:00+01'),
  ('lot-83', 'Organigramme refait',
   'Postes, descriptions, déplacement par glisser-déposer, et un affichage plus clair sur mobile.', 'amelioration', '2026-11-15 12:00+01'),
  ('lot-84', 'Boîtes chanceuses et nouveaux objets à effet',
   'Au comptoir, un vendeur peut composer une boîte : l''acheteur tire un objet au hasard parmi son contenu. Nouveaux effets d''objets : bouclier anti-farces, renommée, clé de la faille.', 'nouveau', '2026-11-16 12:00+01'),
  ('lot-85', 'Puissance globale et recrutement de renforts',
   'Une quête peut demander une puissance à réunir à plusieurs. Les participants recrutent des renforts (rangs E à Divin) contre de l''argent, avec un bonus de chance au choix ; trois renforts au plus par quête.', 'nouveau', '2026-11-17 19:00+01')
on conflict (slug) do nothing;

-- ---------------------------------------------------------
-- 2. Recherche dans la base (fondateur)
-- ---------------------------------------------------------
-- Tables et colonnes du schéma public, avec une estimation du nombre de lignes.
create or replace function public.founder_db_tables()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public._is_founder() then raise exception 'Réservé au fondateur.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'table', c.relname,
             'view', c.relkind <> 'r',
             'rows', greatest(c.reltuples, 0)::bigint,
             'columns', (select jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod)) order by a.attnum)
                         from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped))
           order by c.relname)
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
  ), '[]'::jsonb);
end;
$$;

-- Requête construite : p_filters = [{"column": "...", "op": "...", "value": "..."}].
-- Opérateurs : eq, ne, lt, lte, gt, gte, contains, starts, ends, is_null, not_null, in.
create or replace function public.founder_db_query(
  p_table text,
  p_columns text[] default '{}',
  p_filters jsonb default '[]',
  p_match text default 'all',
  p_order text default null,
  p_desc boolean default false,
  p_limit int default 50,
  p_offset int default 0)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_oid oid;
  v_cols text[];
  v_sel text;
  v_where text := '';
  v_parts text[] := '{}';
  v_f jsonb;
  v_col text;
  v_op text;
  v_val text;
  v_expr text;
  v_order text := '';
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 500));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_rows jsonb;
  v_count bigint;
begin
  if not public._is_founder() then raise exception 'Réservé au fondateur.'; end if;
  perform set_config('statement_timeout', '10s', true);

  select c.oid into v_oid from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname = p_table and c.relkind in ('r', 'v', 'm', 'p');
  if v_oid is null then raise exception 'Table inconnue : %', p_table; end if;

  select array_agg(a.attname::text order by a.attnum) into v_cols
    from pg_attribute a where a.attrelid = v_oid and a.attnum > 0 and not a.attisdropped;

  if cardinality(coalesce(p_columns, '{}')) = 0 then
    v_sel := '*';
  else
    if exists (select 1 from unnest(p_columns) x where not (x = any (v_cols))) then
      raise exception 'Colonne inconnue dans la sélection.';
    end if;
    v_sel := (select string_agg(format('%I', x), ', ') from unnest(p_columns) x);
  end if;

  if jsonb_typeof(coalesce(p_filters, '[]'::jsonb)) <> 'array' then raise exception 'Filtres invalides.'; end if;
  for v_f in select * from jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) loop
    v_col := v_f->>'column';
    v_op := v_f->>'op';
    v_val := v_f->>'value';
    if v_col is null or not (v_col = any (v_cols)) then raise exception 'Colonne inconnue : %', coalesce(v_col, '(vide)'); end if;
    v_expr := case v_op
      when 'eq' then format('%I = %L', v_col, v_val)
      when 'ne' then format('%I <> %L', v_col, v_val)
      when 'lt' then format('%I < %L', v_col, v_val)
      when 'lte' then format('%I <= %L', v_col, v_val)
      when 'gt' then format('%I > %L', v_col, v_val)
      when 'gte' then format('%I >= %L', v_col, v_val)
      when 'contains' then format('%I::text ilike %L', v_col, '%' || coalesce(v_val, '') || '%')
      when 'starts' then format('%I::text ilike %L', v_col, coalesce(v_val, '') || '%')
      when 'ends' then format('%I::text ilike %L', v_col, '%' || coalesce(v_val, ''))
      when 'is_null' then format('%I is null', v_col)
      when 'not_null' then format('%I is not null', v_col)
      when 'in' then format('%I::text = any (%L::text[])', v_col,
                            (select array_agg(btrim(x)) from unnest(string_to_array(coalesce(v_val, ''), ',')) x))
      else null
    end;
    if v_expr is null then raise exception 'Opérateur inconnu : %', coalesce(v_op, '(vide)'); end if;
    v_parts := v_parts || v_expr;
  end loop;
  if cardinality(v_parts) > 0 then
    v_where := ' where ' || array_to_string(v_parts, case when p_match = 'any' then ' or ' else ' and ' end);
  end if;

  if p_order is not null and p_order <> '' then
    if not (p_order = any (v_cols)) then raise exception 'Colonne de tri inconnue.'; end if;
    v_order := format(' order by %I %s nulls last', p_order, case when p_desc then 'desc' else 'asc' end);
  end if;

  begin
    execute format('select count(*) from public.%I%s', p_table, v_where) into v_count;
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select %s from public.%I%s%s limit %s offset %s) t',
                   v_sel, p_table, v_where, v_order, v_limit, v_offset) into v_rows;
  exception
    when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range or invalid_parameter_value then
      raise exception 'Valeur incompatible avec le type de la colonne (%).', sqlerrm;
    when undefined_function or datatype_mismatch or cannot_coerce then
      raise exception 'Cet opérateur ne s''applique pas à ce type de colonne (%).', sqlerrm;
    when query_canceled then
      raise exception 'Requête trop longue (10 s) : ajoute un filtre.';
  end;

  return jsonb_build_object('count', v_count, 'rows', v_rows, 'sql', format('select %s from public.%I%s%s limit %s offset %s', v_sel, p_table, v_where, v_order, v_limit, v_offset));
end;
$$;

-- Cherche un texte dans toutes les colonnes de toutes les tables.
create or replace function public.founder_db_search(p_text text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_n bigint;
  v_out jsonb := '[]'::jsonb;
begin
  if not public._is_founder() then raise exception 'Réservé au fondateur.'; end if;
  if p_text is null or char_length(btrim(p_text)) < 2 then raise exception 'Écris au moins 2 caractères.'; end if;
  perform set_config('statement_timeout', '25s', true);

  for r in
    select c.relname as t, a.attname as col
    from pg_class c
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    order by c.relname, a.attnum
  loop
    execute format('select count(*) from public.%I where %I::text ilike %L', r.t, r.col, '%' || p_text || '%') into v_n;
    if v_n > 0 then
      v_out := v_out || jsonb_build_object('table', r.t, 'column', r.col, 'count', v_n);
    end if;
  end loop;
  return v_out;
exception
  when query_canceled then
    raise exception 'Recherche trop longue : précise le texte.';
end;
$$;

revoke execute on function public.founder_db_tables() from public, anon;
revoke execute on function public.founder_db_query(text, text[], jsonb, text, text, boolean, int, int) from public, anon;
revoke execute on function public.founder_db_search(text) from public, anon;
grant execute on function public.founder_db_tables() to authenticated;
grant execute on function public.founder_db_query(text, text[], jsonb, text, text, boolean, int, int) to authenticated;
grant execute on function public.founder_db_search(text) to authenticated;

notify pgrst, 'reload schema';
