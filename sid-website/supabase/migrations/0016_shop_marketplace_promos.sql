-- =========================================================
-- Boutique : remise en vente / retrait d'un objet, prix modifiable en
-- permanence, promotions temporaires, et reversement de l'argent des
-- ventes au créateur de l'objet (au lieu de disparaître).
-- =========================================================

alter table public.shop_items add column sale_price numeric(10,2);
alter table public.shop_items add column sale_ends_at timestamptz;

comment on column public.shop_items.sale_price is
  'Prix promotionnel optionnel. Si renseigné et non expiré (sale_ends_at), prime sur "price" lors de l''achat.';
comment on column public.shop_items.sale_ends_at is
  'Fin de la promotion. NULL = promotion sans date de fin tant que sale_price est renseigné.';

-- Le créateur d'un objet peut désormais le gérer lui-même (le remettre en
-- vente / le retirer via is_active, changer son prix, lancer une promo),
-- même s'il n'a plus (ou jamais eu au-delà de la création) la permission
-- manage_shop de façon permanente.
create policy "shop_items_manage_own" on public.shop_items for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- purchase_item : utilise le prix effectif (promo si active), et reverse
-- le montant de la vente au créateur de l'objet plutôt que de le faire
-- disparaître.
create or replace function public.purchase_item(p_item_id uuid, p_quantity int default 1)
returns public.purchases
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.shop_items;
  v_balance numeric(12,2);
  v_unit_price numeric(10,2);
  v_total numeric(10,2);
  v_purchase public.purchases;
begin
  if p_quantity < 1 then
    raise exception 'La quantité doit être au moins 1';
  end if;

  select * into v_item from public.shop_items where id = p_item_id and is_active for update;
  if v_item.id is null then
    raise exception 'Objet introuvable ou indisponible';
  end if;

  if v_item.stock is not null and v_item.stock < p_quantity then
    raise exception 'Stock insuffisant';
  end if;

  v_unit_price := case
    when v_item.sale_price is not null and (v_item.sale_ends_at is null or v_item.sale_ends_at > now())
      then v_item.sale_price
    else v_item.price
  end;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  v_total := v_unit_price * p_quantity;

  if v_balance is null or v_balance < v_total then
    raise exception 'Solde insuffisant';
  end if;

  update public.wallets set balance = balance - v_total where user_id = auth.uid();

  insert into public.purchases (item_id, user_id, quantity, total_price, status)
  values (p_item_id, auth.uid(), p_quantity, v_total, 'pending')
  returning * into v_purchase;

  insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
  values (auth.uid(), -v_total, 'Achat : ' || v_item.name, v_purchase.id, auth.uid());

  if v_item.created_by is not null and v_item.created_by <> auth.uid() then
    update public.wallets set balance = balance + v_total where user_id = v_item.created_by;

    insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
    values (v_item.created_by, v_total, 'Vente : ' || v_item.name, v_purchase.id, auth.uid());
  end if;

  if v_item.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = p_item_id;
  end if;

  return v_purchase;
end;
$$;

-- Liste les objets créés par l'utilisateur connecté (actifs ou non), pour
-- l'écran "mes objets en vente" — is_active y compris à false, contrairement
-- au flux d'achat public.
create or replace function public.list_my_shop_items()
returns setof public.shop_items
language sql
stable
security definer set search_path = public
as $$
  select * from public.shop_items where created_by = auth.uid() order by created_at desc;
$$;
