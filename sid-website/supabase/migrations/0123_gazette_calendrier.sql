-- =====================================================================
-- 0123 — La Gazette et le Calendrier (Lot 97)
-- À lancer après 0122 (et après les migrations du Wiki et de la
-- Cartographie). Aucune table ne change. Peut être relancée.
--
-- * gazette(p_jour) : l'édition de la semaine (lundi → dimanche, heure du
--   jeu) qui contient p_jour : nouveaux membres, quêtes réussies et leurs
--   héros, réputation gagnée, bourse, enchères, mariages, sondages clos,
--   découvertes du Wiki et de la Cartographie, annonces. Calculée à la
--   demande : la semaine en cours se remplit au fil des jours.
--   Les comptes invisibles n'y apparaissent jamais. Un lieu de la Carto que
--   le lecteur n'a pas parcouru (brouillard) reste « inexploré ».
-- * calendrier(p_debut, p_fin) : ce qui tombe entre deux dates (100 jours
--   au plus) : échéances des quêtes visibles, fins d'enchères, clôtures de
--   sondages, anniversaires, impôts du lecteur, événements du jeu.
-- =====================================================================

-- Lundi de la semaine (heure du jeu) d'une date.
create or replace function public._lundi(p_jour date)
returns date
language sql immutable
as $$ select p_jour - ((extract(isodow from p_jour)::int + 6) % 7) $$;

-- (volatile : elle remplit une table temporaire le temps de l'appel)
create or replace function public.gazette(p_jour date default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := public.stats_timezone();
  v_aujourdhui date := (now() at time zone v_tz)::date;
  v_lundi date := public._lundi(least(coalesce(p_jour, v_aujourdhui), v_aujourdhui));
  v_debut timestamptz := (v_lundi::timestamp at time zone v_tz);
  v_fin timestamptz := ((v_lundi + 7)::timestamp at time zone v_tz);
  v_map_all boolean := false;
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;

  -- Membres qu'on peut nommer : actifs, pas invisibles.
  if to_regclass('pg_temp._gz_visibles') is null then
    create temp table _gz_visibles (id uuid primary key, nickname text, avatar_url text) on commit drop;
  else
    truncate _gz_visibles;
  end if;
  insert into _gz_visibles
  select p.id, p.nickname, p.avatar_url from public.profiles p
  where p.status = 'active' and not coalesce(p.is_invisible, false);

  v_out := jsonb_build_object(
    'semaine', jsonb_build_object(
      'debut', v_lundi, 'fin', v_lundi + 6,
      'numero', extract(week from v_lundi)::int, 'annee', extract(isoyear from v_lundi)::int,
      'en_cours', v_aujourdhui < v_lundi + 7,
      'precedente', v_lundi - 7,
      'suivante', case when v_lundi + 7 <= v_aujourdhui then v_lundi + 7 end),

    'nouveaux', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'nickname', v.nickname, 'avatar_url', v.avatar_url) order by p.created_at)
      from public.profiles p join _gz_visibles v on v.id = p.id
      where p.created_at >= v_debut and p.created_at < v_fin), '[]'),

    -- Quêtes réussies : récompense versée cette semaine.
    'quetes', coalesce((
      select jsonb_agg(q order by (q->>'reward')::numeric desc nulls last)
      from (
        select jsonb_build_object(
                 'id', qu.id, 'title', qu.title, 'difficulty', qu.difficulty, 'reward', qu.reward,
                 'heros', coalesce((
                   select jsonb_agg(distinct v.nickname) from public.transactions t join _gz_visibles v on v.id = t.user_id
                   where t.related_quest_id = qu.id and t.amount > 0 and t.created_at >= v_debut and t.created_at < v_fin), '[]')) as q
        from public.quests qu
        where qu.status = 'completed' and qu.visibility in ('public', 'members')
          and exists (select 1 from public.transactions t where t.related_quest_id = qu.id and t.amount > 0
                      and t.created_at >= v_debut and t.created_at < v_fin)
        limit 12) s), '[]'),

    'reputation', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname, 'avatar_url', avatar_url, 'gain', gain) order by gain desc)
      from (
        select v.id, v.nickname, v.avatar_url, sum(r.delta) as gain
        from public.reputation_events r join _gz_visibles v on v.id = r.user_id
        where r.created_at >= v_debut and r.created_at < v_fin
        group by v.id, v.nickname, v.avatar_url
        having sum(r.delta) > 0
        order by gain desc
        limit 3) s), '[]'),

    -- Bourse : variation entre le premier et le dernier cours de la semaine.
    'bourse', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'debut', p0, 'fin', p1, 'pct', round((p1 - p0) / p0 * 100, 1)) order by abs(p1 - p0) / p0 desc)
      from (
        select b.id, b.name,
               (select h.price from public.business_share_price_history h where h.business_id = b.id and h.recorded_at < v_fin order by h.recorded_at desc limit 1) as p1,
               coalesce(
                 (select h.price from public.business_share_price_history h where h.business_id = b.id and h.recorded_at < v_debut order by h.recorded_at desc limit 1),
                 (select h.price from public.business_share_price_history h where h.business_id = b.id and h.recorded_at >= v_debut order by h.recorded_at limit 1)) as p0
        from public.businesses b
        where not coalesce(b.is_closed, false)
      ) s
      where p0 > 0 and p1 is not null and p1 <> p0
      ), '[]'),
    -- (le site garde les trois plus fortes hausses et baisses)

    'encheres', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'item', i.name, 'quantity', a.quantity, 'price', a.current_price,
                                          'gagnant', v.nickname) order by a.current_price desc)
      from (select * from public.auctions a where a.status = 'sold' and a.settled_at >= v_debut and a.settled_at < v_fin
            order by a.current_price desc limit 5) a
      join public.shop_items i on i.id = a.item_id
      left join _gz_visibles v on v.id = a.top_bidder), '[]'),

    'mariages', coalesce((
      select jsonb_agg(jsonb_build_object('a', va.nickname, 'b', vb.nickname, 'a_avatar', va.avatar_url, 'b_avatar', vb.avatar_url, 'date', w.married_at) order by w.married_at)
      from public.weddings w
      join _gz_visibles va on va.id = w.partner_a
      join _gz_visibles vb on vb.id = w.partner_b
      where w.married_at >= v_debut and w.married_at < v_fin and w.status = 'married'), '[]'),

    -- Sondages clos : l'option en tête (jamais le détail des votants).
    'sondages', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'question', p.question, 'votants', nb,
                                          'gagnant', top_label, 'voix', top_voix) order by cl)
      from (
        select p.id, p.question, coalesce(p.closed_at, p.closes_at) as cl,
               (select count(distinct pv.user_id) from public.poll_votes pv where pv.poll_id = p.id) as nb,
               (select o.label from public.poll_options o left join public.poll_votes pv on pv.option_id = o.id
                 where o.poll_id = p.id group by o.id, o.label, o.position order by count(pv.user_id) desc, o.position limit 1) as top_label,
               (select count(pv.user_id) from public.poll_options o left join public.poll_votes pv on pv.option_id = o.id
                 where o.poll_id = p.id group by o.id, o.position order by count(pv.user_id) desc, o.position limit 1) as top_voix
        from public.polls p
        where coalesce(p.closed_at, p.closes_at) >= v_debut and coalesce(p.closed_at, p.closes_at) < v_fin
          and coalesce(p.closed_at, p.closes_at) <= now()
          and (p.publish_at is null or p.publish_at <= now())
      ) p), '[]'),

    'annonces', coalesce((
      select jsonb_agg(jsonb_build_object('title', a.title, 'date', a.created_at) order by a.created_at)
      from public.announcements a
      where a.created_at >= v_debut and a.created_at < v_fin), '[]'),

    'chiffres', jsonb_build_object(
      'messages', (select count(*) from public.chat_messages m where m.created_at >= v_debut and m.created_at < v_fin),
      'quetes_creees', (select count(*) from public.quests q where q.created_at >= v_debut and q.created_at < v_fin and q.visibility in ('public', 'members')),
      'encheres', (select count(*) from public.auctions a where a.status = 'sold' and a.settled_at >= v_debut and a.settled_at < v_fin))
  );

  -- Wiki : fiches découvertes cette semaine.
  if to_regclass('public.wiki_entries') is not null then
    v_out := v_out || jsonb_build_object('wiki', coalesce((
      select jsonb_agg(jsonb_build_object('category', e.category, 'number', e.number, 'title', e.title, 'image_url', e.image_url,
                                          'decouvreur', v.nickname) order by e.discovered_at)
      from (select * from public.wiki_entries e where e.discovered and e.discovered_at >= v_debut and e.discovered_at < v_fin
            order by e.discovered_at limit 24) e
      left join _gz_visibles v on v.id = e.discovered_by), '[]'));
  end if;

  -- Cartographie : lieux découverts cette semaine, nommés seulement si le
  -- lecteur les a parcourus (ou brouillard coupé, ou gestion de la carte).
  if to_regclass('public.map_places') is not null then
    v_map_all := coalesce(public.has_permission(v_uid, 'manage_map'), false)
                 or not coalesce((select s.fog_enabled from public.map_settings s where s.id = 1), true);
    v_out := v_out || jsonb_build_object('carto', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', case when connu then m.id end,
               'name', case when connu then m.name end,
               'type', case when connu then m.type end,
               'decouvreur', v.nickname) order by m.discovered_at)
      from (
        select m.*, (v_map_all or exists (select 1 from public.exploration_visits x where x.user_id = v_uid and x.place_id = m.id)) as connu
        from public.map_places m
        where m.is_published and m.discovered_at >= v_debut and m.discovered_at < v_fin
      ) m
      left join _gz_visibles v on v.id = m.discovered_by), '[]'));
  end if;

  v_out := jsonb_set(v_out, '{chiffres,decouvertes}', to_jsonb(
    coalesce(jsonb_array_length(v_out->'wiki'), 0) + coalesce(jsonb_array_length(v_out->'carto'), 0)));
  return v_out;
end;
$$;
revoke execute on function public.gazette(date) from public, anon;
grant execute on function public.gazette(date) to authenticated;

create or replace function public.calendrier(p_debut date, p_fin date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := public.stats_timezone();
  v_d0 timestamptz;
  v_d1 timestamptz;
  v_out jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_debut is null or p_fin is null or p_fin < p_debut then raise exception 'Période invalide.'; end if;
  if p_fin - p_debut > 100 then raise exception 'Période trop longue (100 jours au plus).'; end if;
  v_d0 := p_debut::timestamp at time zone v_tz;
  v_d1 := (p_fin + 1)::timestamp at time zone v_tz;

  -- Quêtes : échéances des quêtes ouvertes ou en cours que le lecteur voit.
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'quete', 'id', q.id, 'titre', q.title,
           'debut', q.deadline, 'detail', 'Rang ' || q.difficulty || ' · ' || round(coalesce(q.reward, 0)) || ' z',
           'lien', '/dashboard/quests?quete=' || q.id,
           'moi', public.is_quest_participant(q.id, v_uid))), '[]') into v_part
  from public.quests q
  where q.deadline >= v_d0 and q.deadline < v_d1 and q.status in ('open', 'in_progress')
    and (q.visibility in ('public', 'members') or q.created_by = v_uid
         or public.has_permission(v_uid, 'manage_quests') or public.is_quest_participant(q.id, v_uid));
  v_out := v_out || v_part;

  -- Enchères en cours.
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'enchere', 'id', a.id, 'titre', i.name || case when a.quantity > 1 then ' ×' || a.quantity else '' end,
           'debut', a.ends_at, 'detail', 'Enchère : ' || round(a.current_price) || ' z' || case when a.top_bidder = v_uid then ' (tu mènes)' else '' end,
           'lien', '/dashboard/shop?enchere=' || a.id,
           'moi', a.top_bidder = v_uid or a.seller_id = v_uid)), '[]') into v_part
  from public.auctions a join public.shop_items i on i.id = a.item_id
  where a.status = 'open' and a.ends_at >= v_d0 and a.ends_at < v_d1;
  v_out := v_out || v_part;

  -- Sondages : clôtures.
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'sondage', 'id', p.id, 'titre', p.question,
           'debut', p.closes_at,
           'detail', case when exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid) then 'Tu as voté'
                          when p.closes_at <= now() then 'Clos' else 'Pas encore voté' end,
           'lien', '/dashboard/polls?sondage=' || p.id,
           'moi', p.closes_at > now() and not exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid))), '[]') into v_part
  from public.polls p
  where p.closed_at is null and p.closes_at >= v_d0 and p.closes_at < v_d1
    and (p.publish_at is null or p.publish_at <= now());
  v_out := v_out || v_part;

  -- Anniversaires (le 29 février tombe le 28 les autres années).
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'anniversaire', 'id', pr.id, 'titre', pr.nickname,
           'debut', d, 'jour', true, 'detail', 'Anniversaire', 'lien', '/dashboard/profile/' || pr.id,
           'image', pr.avatar_url, 'moi', pr.id = v_uid)), '[]') into v_part
  from public.member_birthdays b
  join public.profiles pr on pr.id = b.user_id and pr.status = 'active' and (not coalesce(pr.is_invisible, false) or pr.id = v_uid)
  cross join lateral (
    select make_date(y, b.month, case when b.month = 2 and b.day = 29 and not (y % 4 = 0 and (y % 100 <> 0 or y % 400 = 0)) then 28 else b.day end) as d
    from generate_series(extract(year from p_debut)::int, extract(year from p_fin)::int) y
  ) x
  where x.d between p_debut and p_fin;
  v_out := v_out || v_part;

  -- Impôts du lecteur.
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'impot', 'id', t.id, 'titre', 'Impôt à payer',
           'debut', t.due_at, 'detail', round(t.amount) || ' z', 'lien', '/dashboard/bank', 'moi', true)), '[]') into v_part
  from public.tax_bills t
  where t.user_id = v_uid and t.status = 'due' and t.due_at >= v_d0 and t.due_at < v_d1;
  v_out := v_out || v_part;

  -- Événements du jeu (périodes de _decor_window), regroupés en plages.
  select coalesce(jsonb_agg(jsonb_build_object('kind', 'evenement', 'id', k || ':' || d0, 'titre', k,
           'debut', d0, 'fin', d1, 'jour', true)), '[]') into v_part
  from (
    select k, min(d) as d0, max(d) as d1
    from (
      select k, d, d - (row_number() over (partition by k order by d))::int as grp
      from unnest(public._decor_keys()) k
      cross join generate_series(p_debut, p_fin, interval '1 day') g(dd)
      cross join lateral (select g.dd::date as d) x
      where public._decor_window(k, x.d)
    ) s
    group by k, grp
  ) e;
  v_out := v_out || v_part;

  return v_out;
end;
$$;
revoke execute on function public.calendrier(date, date) from public, anon;
grant execute on function public.calendrier(date, date) to authenticated;
