-- =========================================================
-- Lot 42 : titres d'événement, à lancer après 0064.
-- Peut être relancée sans risque.
--
-- Chaque événement (Halloween, Noël, et les suivants) a son titre. Il ne
-- s'obtient que pendant que l'événement est affiché (site_decor), puis se
-- garde pour toujours. Chacun donne un pouvoir de farce, comme les autres.
--
-- Pour un nouvel événement : une clé dans site_decor (comme 0064), une ligne
-- dans titles avec event = cette clé, sa règle dans _event_rule et son
-- apparition côté site (composant scellé).
-- =========================================================

alter table public.titles add column if not exists event text;

insert into public.titles (id, name, power, max_level, sort, event) values
  ('chauvesouris', 'Maître des Chauves-Souris', 'nuee', 1, 101, 'halloween'),
  ('lutin', 'Lutin Clandestin', 'blizzard', 1, 102, 'noel')
on conflict (id) do update
  set name = excluded.name, power = excluded.power, max_level = excluded.max_level, sort = excluded.sort, event = excluded.event;

-- ---------------------------------------------------------
-- Options des deux nouvelles farces. L'ancienne fonction (0062) devient
-- _troll_params_base ; celle-ci ajoute les nouveaux pouvoirs devant.
-- ---------------------------------------------------------
do $$
begin
  if to_regprocedure('public._troll_params_base(text, integer, jsonb)') is null then
    alter function public._troll_params(text, integer, jsonb) rename to _troll_params_base;
  end if;
end;
$$;

create or replace function public._troll_params(p_power text, p_level int, p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  p0 jsonb := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
begin
  if p_power = 'nuee' then
    return jsonb_build_object('density', public._jint(p0, 'density', 2, 1, 3), 'hanging', public._jint(p0, 'hanging', 3, 0, 5));
  elsif p_power = 'blizzard' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'frost', public._jbool(p0, 'frost', true));
  end if;
  return public._troll_params_base(p_power, p_level, p);
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := 'a3e487247a9289d53c145b83';
  b bytea := decode('
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
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;

