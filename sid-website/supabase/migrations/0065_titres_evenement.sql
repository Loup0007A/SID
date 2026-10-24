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
  when 'assaut' then
    return jsonb_build_object('beast', public._jpick(p0, 'beast', array['braise', 'givre', 'orage'], 'braise'),
      'fury', public._jint(p0, 'fury', 2, 1, 3), 'repel', public._jbool(p0, 'repel', true),
      'message', coalesce(public._jtxt(p0->>'message', 60), ''));
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := 'c1154fccf9c6abcbf8ac0c8b';
  b bytea := decode('
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
DE/dd5KUS3VnoA==
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;

