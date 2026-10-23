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
-- Options des farces ajoutées depuis 0062 (mêmes définitions que 0067 :
-- relancer 0065 ne retire rien). L'ancienne fonction (0062) devient
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
  case p_power
  when 'nuee' then
    return jsonb_build_object('density', public._jint(p0, 'density', 2, 1, 3), 'hanging', public._jint(p0, 'hanging', 3, 0, 5));
  when 'blizzard' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'frost', public._jbool(p0, 'frost', true));
  when 'coup_de_foudre' then
    return jsonb_build_object('color', public._jpick(p0, 'color', array['rose', 'rouge', 'arcenciel'], 'rose'), 'name', public._jbool(p0, 'name', true));
  when 'poisson' then
    return jsonb_build_object('count', public._jint(p0, 'count', 6, 2, 12), 'fake', public._jbool(p0, 'fake', true));
  when 'cloches' then
    return jsonb_build_object('amount', public._jint(p0, 'amount', 2, 1, 3));
  when 'greve' then
    return jsonb_build_object('every', public._jint(p0, 'every', 2, 1, 3), 'placards', public._jbool(p0, 'placards', true));
  when 'fanfare' then
    return jsonb_build_object('tempo', public._jpick(p0, 'tempo', array['lent', 'moyen', 'rapide'], 'moyen'), 'bounce', public._jbool(p0, 'bounce', true));
  when 'artifice' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'patrouille', public._jbool(p0, 'patrouille', true));
  when 'treve' then
    return jsonb_build_object('message', coalesce(public._jtxt(p0->>'message', 60), ''));
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := '543bfd92d76c5d815ce1d056';
  b bytea := decode('
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
+n3wE0pSxH5xXH9nnZYZ1LPA
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;

