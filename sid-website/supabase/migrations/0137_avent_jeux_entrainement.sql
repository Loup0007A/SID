-- =====================================================================
-- 0137 — Calendrier de l'avent : 4 nouveaux jeux, glouton mieux payé,
-- entraînement des membres et objet « Essais d'entraînement » (Lot 103).
--
-- * Jeux : livraison par la cheminée, course de luge, mémoire des boules de
--   Noël, carillon. Placés dans les cases 8 à 11 si elles sont vides.
-- * Glouton : environ 2,5 fois plus de points (contrôle des scores ajusté).
-- * Entraînement : chaque membre peut essayer chaque jeu du calendrier
--   3 fois (réglable), hors classement. Au-delà, il lui faut des essais
--   d'entraînement, gagnés en utilisant un objet de la boutique doté du
--   nouvel effet « avent_essais » (N essais par exemplaire, valables sur
--   tous les jeux).
-- Rejouable.
-- =====================================================================

insert into public.avent_jeux (jeu, nom, consigne, min_secondes, score_max, score_par_seconde) values
  ('glouton', 'Le Glouton du réveillon', 'Mange tous les chocolats du labyrinthe sans te faire attraper (25 points). Les étoiles retournent les lutins (500, 1 000, 2 000, 4 000). Chaque niveau vidé (+1 200) accélère le jeu. 3 vies.', 3, 150000, 800),
  ('cheminees', 'Livraison par la cheminée', '60 secondes : lâche les cadeaux dans les cheminées depuis le traîneau. 50 points, +10 par livraison réussie d''affilée. Évite les cheminées qui fument (−30).', 5, 15000, 250),
  ('luge', 'Course de luge', 'Saute par-dessus les rochers et les bonshommes de neige ; garde appuyé pour sauter plus haut. La piste accélère. 1 point tous les 12 pas, 25 par étoile.', 2, 100000, 120),
  ('memoire', 'Mémoire des boules de Noël', '75 secondes : retrouve les paires de boules. 100 points par paire, plus 20 par paire trouvée d''affilée ; −10 par erreur. Chaque plateau terminé (+200) en amène un plus grand.', 5, 40000, 400),
  ('carillon', 'Le Carillon', 'Écoute la mélodie des cloches, puis rejoue-la dans l''ordre. Une note de plus à chaque manche, de plus en plus vite. 25 points par note ; deux fausses notes permises.', 3, 50000, 60)
on conflict (jeu) do update set nom = excluded.nom, consigne = excluded.consigne, min_secondes = excluded.min_secondes,
  score_max = excluded.score_max, score_par_seconde = excluded.score_par_seconde;

update public.avent_cases k set jeu = v.jeu, updated_at = now()
from (values (8, 'cheminees'), (9, 'luge'), (10, 'memoire'), (11, 'carillon')) as v(jour, jeu)
where k.jour = v.jour and k.jeu is null;

-- ---------------------------------------------------------------------
-- Entraînement
-- ---------------------------------------------------------------------
alter table public.avent_config add column if not exists entrainements_gratuits int not null default 3;
alter table public.avent_config drop constraint if exists avent_config_entrainements_check;
alter table public.avent_config add constraint avent_config_entrainements_check check (entrainements_gratuits between 0 and 20);

create table if not exists public.avent_entrainements (
  edition int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  jeu text not null references public.avent_jeux(jeu) on delete cascade,
  utilises int not null default 0,
  dernier_at timestamptz,
  primary key (edition, user_id, jeu)
);
create table if not exists public.avent_essais_bonus (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  credits int not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);
alter table public.avent_entrainements enable row level security;
alter table public.avent_essais_bonus enable row level security;
revoke all on public.avent_entrainements, public.avent_essais_bonus from public, anon, authenticated;

create or replace function public.avent_entrainement_etat()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ed int := public._avent_edition();
  v_gratuits int := (select entrainements_gratuits from public.avent_config where id = 1);
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  return jsonb_build_object(
    'gratuits', v_gratuits,
    'credits', coalesce((select credits from public.avent_essais_bonus where user_id = v_uid), 0),
    'jeux', coalesce((
      select jsonb_agg(jsonb_build_object(
               'jeu', j.jeu, 'nom', j.nom, 'consigne', j.consigne, 'premiere_case', x.premiere,
               'utilises', coalesce(e.utilises, 0),
               'restants', greatest(0, v_gratuits - coalesce(e.utilises, 0))) order by x.premiere)
      from (select k.jeu, min(k.jour) as premiere from public.avent_cases k where k.jeu is not null group by k.jeu) x
      join public.avent_jeux j on j.jeu = x.jeu
      left join public.avent_entrainements e on e.edition = v_ed and e.user_id = v_uid and e.jeu = x.jeu
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.avent_entrainement_commencer(p_jeu text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ed int := public._avent_edition();
  v_gratuits int;
  v_util int;
  v_credits int;
  v_credit_pris boolean := false;
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'Réservé aux membres.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.avent_cases where jeu = p_jeu) then
    raise exception 'Ce jeu n''est pas dans le calendrier.';
  end if;
  if not (select actif from public.avent_config where id = 1) then
    raise exception 'Le calendrier de l''avent est fermé.';
  end if;
  select entrainements_gratuits into v_gratuits from public.avent_config where id = 1;

  insert into public.avent_entrainements (edition, user_id, jeu) values (v_ed, v_uid, p_jeu)
  on conflict (edition, user_id, jeu) do nothing;
  select utilises into v_util from public.avent_entrainements
  where edition = v_ed and user_id = v_uid and jeu = p_jeu for update;

  if v_util >= v_gratuits then
    select credits into v_credits from public.avent_essais_bonus where user_id = v_uid for update;
    if coalesce(v_credits, 0) < 1 then
      raise exception 'Tes % essais d''entraînement sur ce jeu sont utilisés. Des objets « Essais d''entraînement » en donnent d''autres (boutique).', v_gratuits;
    end if;
    update public.avent_essais_bonus set credits = credits - 1, updated_at = now() where user_id = v_uid;
    v_credit_pris := true;
  end if;
  update public.avent_entrainements set utilises = utilises + 1, dernier_at = now()
  where edition = v_ed and user_id = v_uid and jeu = p_jeu;

  return jsonb_build_object(
    'graine', floor(random() * 2147483646)::int + 1,
    'restants', greatest(0, v_gratuits - v_util - 1),
    'credit_utilise', v_credit_pris,
    'credits', coalesce((select credits from public.avent_essais_bonus where user_id = v_uid), 0));
end;
$$;

create or replace function public.avent_config_set(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public._avent_admin_garde();
  c public.avent_config;
  v_debut date;
  v_fin timestamptz;
begin
  select * into c from public.avent_config where id = 1 for update;
  v_debut := coalesce((p->>'debut')::date, c.debut);
  v_fin := coalesce((p->>'fin')::timestamptz, c.fin);
  if v_fin <= (v_debut::timestamp at time zone 'Europe/Paris') then
    raise exception 'La clôture doit tomber après l''ouverture de la case 1.';
  end if;
  update public.avent_config set
    actif = coalesce((p->>'actif')::boolean, actif),
    debut = v_debut,
    fin = v_fin,
    essais_par_jour = coalesce((p->>'essais_par_jour')::int, essais_par_jour),
    bonus_jour = coalesce((p->>'bonus_jour')::int, bonus_jour),
    entrainements_gratuits = coalesce((p->>'entrainements_gratuits')::int, entrainements_gratuits),
    -- Nouvelle édition (autre année) : annonces et distribution repartent de zéro.
    derniere_annonce = case when extract(year from v_debut) <> extract(year from c.debut) then null else derniere_annonce end,
    fin_annoncee = case when v_fin <> c.fin or extract(year from v_debut) <> extract(year from c.debut) then false else fin_annoncee end,
    distribue_at = case when extract(year from v_debut) <> extract(year from c.debut) then null else distribue_at end,
    distribue_par = case when extract(year from v_debut) <> extract(year from c.debut) then null else distribue_par end,
    updated_at = now()
  where id = 1;
  perform public.write_audit('avent_config', null, p, null);
end;
$$;

-- ---------------------------------------------------------------------
-- Objet de boutique « Essais d'entraînement » (effet avent_essais)
-- ---------------------------------------------------------------------
alter table public.shop_items drop constraint if exists shop_items_effect_check;
alter table public.shop_items add constraint shop_items_effect_check
  check (effect in ('reset_cooldowns', 'heal_injury', 'prank_shield', 'fame', 'envers_key', 'avent_essais'));
alter table public.member_consumables drop constraint if exists member_consumables_effect_check;
alter table public.member_consumables add constraint member_consumables_effect_check
  check (effect in ('reset_cooldowns', 'heal_injury', 'prank_shield', 'fame', 'envers_key', 'avent_essais'));

create or replace function public._shop_effect_power(p_effect text, p_value int)
returns int
language sql immutable
as $$
  select case p_effect
    when 'prank_shield' then greatest(1, least(168, coalesce(p_value, 24)))
    when 'fame' then greatest(1, least(1000, coalesce(p_value, 10)))
    when 'avent_essais' then greatest(1, least(50, coalesce(p_value, 3)))
    else 0 end;
$$;

-- Reprise de 0101, avec l'effet avent_essais.
create or replace function public.use_item_effect(p_effect text, p_power int default 0)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_power int := coalesce(p_power, 0);
  v_qty int;
  v_n int;
  v_until timestamptz;
  v_msg text;
  v_res jsonb;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;

  if p_effect = 'reset_cooldowns' then
    v_res := public.use_cooldown_reset();
    return v_res || jsonb_build_object(
      'effect', p_effect,
      'message', case when coalesce((v_res->>'cleared')::int, 0) > 0
                      then (v_res->>'cleared') || ' délai(s) effacé(s) dans les simulations.'
                      else 'Aucun délai en cours : les simulations sont déjà libres.' end);
  end if;

  select quantity into v_qty from public.member_consumables
  where user_id = v_uid and effect = p_effect and power = v_power
  for update;
  if coalesce(v_qty, 0) < 1 then
    raise exception 'Tu n''as plus cet objet.';
  end if;

  if p_effect = 'heal_injury' then
    delete from public.simulation_injuries where user_id = v_uid and until > now();
    get diagnostics v_n = row_count;
    if v_n = 0 then
      raise exception 'Tu n''as aucune blessure à soigner : garde ton Soin pour plus tard.';
    end if;
    v_msg := case when v_n > 1 then v_n || ' blessures soignées' else 'Blessure soignée' end
             || ' : tu peux reprendre les simulations.';

  elsif p_effect = 'prank_shield' then
    perform public._troll_shields_purge();
    if exists (select 1 from public.troll_shields where user_id = v_uid and expires_at is null) then
      raise exception 'L''administration te protège déjà des farces, sans limite de durée.';
    end if;
    v_until := greatest(coalesce((select expires_at from public.troll_shields where user_id = v_uid), now()), now())
               + make_interval(hours => greatest(v_power, 1));
    insert into public.troll_shields (user_id, set_by, reason, expires_at, source)
    values (v_uid, v_uid, 'Bouclier anti-farces (objet)', v_until, 'objet')
    on conflict (user_id) do update
      set expires_at = excluded.expires_at, reason = excluded.reason, set_by = excluded.set_by, source = 'objet';
    update public.troll_actions set cancelled_at = now(), cancelled_by = v_uid
    where target_id = v_uid and cancelled_at is null and ends_at > now();
    get diagnostics v_n = row_count;
    v_msg := 'Protégé des farces jusqu''au ' || to_char(v_until at time zone 'Europe/Paris', 'DD/MM à HH24:MI')
             || case when v_n > 0 then ' ; ' || v_n || ' farce(s) en cours arrêtée(s).' else '.' end;

  elsif p_effect = 'fame' then
    perform public._add_reputation(v_uid, greatest(v_power, 1), 'Objet de la boutique', null, null);
    v_msg := '+' || greatest(v_power, 1) || ' renommée.';

  elsif p_effect = 'envers_key' then
    if not exists (select 1 from public.envers_config where id = 1 and is_open) then
      raise exception 'La faille est refermée pour le moment : garde ta clé.';
    end if;
    insert into public.envers_stays (user_id) values (v_uid) on conflict (user_id) do nothing;
    update public.envers_stays set last_found_at = now() where user_id = v_uid;
    v_msg := 'L''Envers de la Cartographie t''est ouvert pendant '
             || round((select access_minutes from public.envers_config where id = 1))::int || ' min.';

  elsif p_effect = 'avent_essais' then
    insert into public.avent_essais_bonus as b (user_id, credits) values (v_uid, greatest(v_power, 1))
    on conflict (user_id) do update set credits = b.credits + excluded.credits, updated_at = now();
    v_msg := '+' || greatest(v_power, 1) || ' essai' || case when greatest(v_power, 1) > 1 then 's' else '' end
             || ' d''entraînement au calendrier de l''avent, valables sur tous les jeux.';

  else
    raise exception 'Effet inconnu.';
  end if;

  update public.member_consumables set quantity = quantity - 1
  where user_id = v_uid and effect = p_effect and power = v_power;

  return jsonb_build_object('effect', p_effect, 'message', v_msg, 'remaining', v_qty - 1);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.avent_entrainement_etat()', 'public.avent_entrainement_commencer(text)', 'public.avent_config_set(jsonb)',
    'public.use_item_effect(text, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Devlog
insert into public.devlog_entries (slug, site, title, body, tag, published_at) values
  ('lot-103-avent-nouveaux-jeux', 'central', 'Avent : 4 nouveaux jeux et entraînement',
   'Quatre nouveaux mini-jeux arrivent dans le calendrier de l''avent : livraison par la cheminée, course de luge, mémoire des boules de Noël et carillon. Chaque jeu du calendrier peut maintenant être essayé 3 fois hors classement (section Entraînement), même avant l''ouverture de sa case. Pour s''entraîner davantage, la boutique peut proposer des objets « Essais d''entraînement ».', 'nouveau', '2026-11-28 21:00+01')
on conflict (slug) do nothing;
