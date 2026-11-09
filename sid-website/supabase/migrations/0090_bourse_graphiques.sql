-- =====================================================================
-- Lot 73 (1/2) : graphiques de bourse. Rejouable. À lancer après 0089.
--
-- market_chart(entreprise, période) renvoie les points d'un graphique de
-- cours, comme sur un site boursier :
--   1J  : la séance du jour, par tranches de 15 minutes (échanges réels) ;
--   5J  : 5 jours, par heure ;
--   1M  : 30 jours, par tranches de 4 heures ;
--   6M, 1A, MAX : un point par jour (bougies journalières ; avant la bourse
--         à carnet d'ordres, l'historique des cours), par semaine au-delà de
--         200 jours.
-- Avec, pour chaque point : ouverture, plus haut, plus bas, clôture, volume ;
-- et pour la période : le cours de référence (clôture de la veille en 1J,
-- dernier cours avant la période sinon), plus haut, plus bas, volume.
-- market_index_chart(période) fait de même pour l'indice SID.
-- =====================================================================

create or replace function public._chart_window(p_range text, out v_from timestamptz, out v_to timestamptz, out v_bucket interval, out v_daily boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  v_midnight timestamptz := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
begin
  v_to := now();
  v_daily := false;
  case upper(coalesce(p_range, '1J'))
    when '1J' then v_from := v_midnight; v_to := v_midnight + interval '1 day'; v_bucket := interval '15 minutes';
    when '5J' then v_from := date_trunc('hour', now() - interval '5 days'); v_bucket := interval '1 hour';
    when '1M' then v_from := date_trunc('hour', now() - interval '30 days'); v_bucket := interval '4 hours';
    when '6M' then v_from := v_midnight - interval '182 days'; v_bucket := interval '1 day'; v_daily := true;
    when '1A' then v_from := v_midnight - interval '365 days'; v_bucket := interval '1 day'; v_daily := true;
    else v_from := '2000-01-01'::timestamptz; v_bucket := interval '1 day'; v_daily := true;
  end case;
end;
$$;

create or replace function public.market_chart(p_business uuid, p_range text default '1J')
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz text := public.stats_timezone();
  b public.businesses;
  w record;
  v_points jsonb;
  v_base numeric;
  v_first_day date;
begin
  select * into b from public.businesses where id = p_business;
  if b.id is null then return null; end if;
  select * into w from public._chart_window(p_range);

  if not w.v_daily then
    select coalesce(jsonb_agg(jsonb_build_object('t', x.t, 'o', x.o, 'h', x.h, 'l', x.l, 'c', x.c, 'v', x.v) order by x.t), '[]'::jsonb)
    into v_points
    from (
      select date_bin(w.v_bucket, at, w.v_from) as t,
             (array_agg(price order by at, id))[1] as o, max(price) as h, min(price) as l,
             (array_agg(price order by at desc, id desc))[1] as c, sum(quantity) as v
      from public.market_trades
      where business_id = p_business and at >= w.v_from and at < w.v_to
      group by 1
    ) x;
    v_base := case when upper(p_range) = '1J' then coalesce(b.ref_price,
                     (select price from public.market_trades where business_id = p_business and at < w.v_from order by at desc, id desc limit 1))
                   else (select price from public.market_trades where business_id = p_business and at < w.v_from order by at desc, id desc limit 1) end;
  else
    -- Jours : bougies de la bourse, complétées avant elles par l'historique des cours.
    select min(day) into v_first_day from public.market_candles where business_id = p_business;
    with days as (
      select day, open as o, high as h, low as l, close as c, volume as v
      from public.market_candles
      where business_id = p_business and day >= (w.v_from at time zone v_tz)::date
      union all
      select d, (array_agg(price order by recorded_at))[1], max(price), min(price), (array_agg(price order by recorded_at desc))[1], 0
      from (select (recorded_at at time zone v_tz)::date as d, price, recorded_at from public.business_share_price_history
            where business_id = p_business and recorded_at >= w.v_from) h
      where v_first_day is null or d < v_first_day
      group by d
    ), agg as (
      -- Au-delà de 200 jours : une bougie par semaine.
      select case when (select count(*) from days) > 200 then date_trunc('week', day)::date else day end as t, day, o, h, l, c, v
      from days
    )
    select coalesce(jsonb_agg(jsonb_build_object('t', y.t, 'o', y.o, 'h', y.h, 'l', y.l, 'c', y.c, 'v', y.v) order by y.t), '[]'::jsonb)
    into v_points
    from (
      select t, (array_agg(o order by day))[1] as o, max(h) as h, min(l) as l, (array_agg(c order by day desc))[1] as c, sum(v) as v
      from agg group by t
    ) y;
    v_base := null;
  end if;

  return jsonb_build_object(
    'range', upper(coalesce(p_range, '1J')),
    'daily', w.v_daily,
    'from', case when w.v_daily then null else w.v_from end,
    'to', case when w.v_daily then null else w.v_to end,
    'now', now(),
    'bucket_minutes', extract(epoch from w.v_bucket) / 60,
    'points', v_points,
    'base', coalesce(v_base, (v_points->0->>'o')::numeric),
    'prev_close', b.ref_price,
    'price', b.share_price,
    'halted_until', b.halted_until
  );
end;
$$;

create or replace function public.market_index_chart(p_range text default '1M')
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  w record;
  v_points jsonb;
begin
  select * into w from public._chart_window(p_range);
  select coalesce(jsonb_agg(jsonb_build_object('t', x.t, 'c', x.c) order by x.t), '[]'::jsonb)
  into v_points
  from (
    select date_bin(w.v_bucket, at, case when w.v_daily then '2000-01-01'::timestamptz else w.v_from end) as t,
           (array_agg(value order by at desc))[1] as c
    from public.market_index_history
    where at >= w.v_from and at < w.v_to
    group by 1
  ) x;
  return jsonb_build_object(
    'range', upper(coalesce(p_range, '1M')),
    'daily', w.v_daily,
    'from', case when w.v_daily then null else w.v_from end,
    'to', case when w.v_daily then null else w.v_to end,
    'now', now(),
    'points', v_points,
    'base', coalesce((select value from public.market_index_history where at < w.v_from order by at desc limit 1), (v_points->0->>'c')::numeric)
  );
end;
$$;

revoke all on function public._chart_window(text) from public, anon, authenticated;
revoke all on function public.market_chart(uuid, text) from public, anon;
grant execute on function public.market_chart(uuid, text) to authenticated;
revoke all on function public.market_index_chart(text) from public, anon;
grant execute on function public.market_index_chart(text) to authenticated;
