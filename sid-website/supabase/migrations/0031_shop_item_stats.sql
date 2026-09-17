-- =========================================================
-- Statistiques par objet de boutique : quantité vendue, revenu généré,
-- nombre d'acheteurs uniques, évolution des ventes (8 dernières semaines).
-- Réservé au créateur de l'objet (le "vendeur") ou à manage_shop — les
-- mêmes personnes qui peuvent déjà éditer la fiche de vente.
-- =========================================================

create or replace function public.get_shop_item_stats(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_item public.shop_items;
  v_quantity_sold bigint;
  v_revenue numeric;
  v_unique_buyers bigint;
  v_weekly jsonb;
begin
  select * into v_item from public.shop_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Objet introuvable';
  end if;

  if not (v_item.created_by = auth.uid() or public.has_permission(auth.uid(), 'manage_shop')) then
    raise exception 'Permission refusée';
  end if;

  select coalesce(sum(quantity), 0), coalesce(sum(total_price), 0), count(distinct user_id)
    into v_quantity_sold, v_revenue, v_unique_buyers
    from public.purchases
    where item_id = p_item_id;

  select coalesce(jsonb_agg(jsonb_build_object('week_start', week_start, 'quantity', quantity, 'revenue', revenue) order by week_start), '[]'::jsonb)
    into v_weekly
    from (
      select date_trunc('week', created_at)::date as week_start, sum(quantity) as quantity, sum(total_price) as revenue
      from public.purchases
      where item_id = p_item_id and created_at >= now() - interval '8 weeks'
      group by 1
    ) t;

  return jsonb_build_object(
    'item_name', v_item.name,
    'quantity_sold', v_quantity_sold,
    'revenue', v_revenue,
    'unique_buyers', v_unique_buyers,
    'weekly_sales', v_weekly
  );
end;
$$;
