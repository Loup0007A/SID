-- =========================================================
-- Fonctions métier — exécutées en SECURITY DEFINER pour pouvoir
-- toucher aux portefeuilles/transactions tout en gardant des
-- vérifications de permission strictes à l'intérieur.
-- =========================================================

-- Achat d'un objet de la boutique par l'utilisateur connecté
create or replace function public.purchase_item(p_item_id uuid, p_quantity int default 1)
returns public.purchases
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.shop_items;
  v_balance numeric(12,2);
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

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  v_total := v_item.price * p_quantity;

  if v_balance is null or v_balance < v_total then
    raise exception 'Solde insuffisant';
  end if;

  update public.wallets set balance = balance - v_total where user_id = auth.uid();

  insert into public.purchases (item_id, user_id, quantity, total_price, status)
  values (p_item_id, auth.uid(), p_quantity, v_total, 'pending')
  returning * into v_purchase;

  insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
  values (auth.uid(), -v_total, 'Achat : ' || v_item.name, v_purchase.id, auth.uid());

  if v_item.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = p_item_id;
  end if;

  return v_purchase;
end;
$$;

-- Validation d'une quête pour un participant : verse la récompense
create or replace function public.validate_quest_participant(p_quest_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_quest public.quests;
begin
  if not public.has_permission(auth.uid(), 'manage_quests') then
    raise exception 'Permission refusée';
  end if;

  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then
    raise exception 'Quête introuvable';
  end if;

  update public.quest_participants
    set status = 'validated'
    where quest_id = p_quest_id and user_id = p_user_id;

  update public.wallets set balance = balance + v_quest.reward where user_id = p_user_id;

  insert into public.transactions (user_id, amount, reason, related_quest_id, created_by)
  values (p_user_id, v_quest.reward, 'Récompense quête : ' || v_quest.title, p_quest_id, auth.uid());
end;
$$;

-- Ajustement manuel du solde d'un membre (bonus, sanction, etc.)
create or replace function public.adjust_wallet(p_user_id uuid, p_amount numeric, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;

  update public.wallets set balance = balance + p_amount where user_id = p_user_id;

  insert into public.transactions (user_id, amount, reason, created_by)
  values (p_user_id, p_amount, coalesce(p_reason, 'Ajustement manuel'), auth.uid());
end;
$$;

-- Acceptation / refus d'une candidature (change le statut + attribue le rôle "Agent" si accepté)
create or replace function public.review_application(p_user_id uuid, p_approve boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_agent_role_id uuid;
begin
  if not public.has_permission(auth.uid(), 'recruit') then
    raise exception 'Permission refusée';
  end if;

  update public.profiles
    set status = case when p_approve then 'active' else 'rejected' end,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_user_id;

  if p_approve then
    select id into v_agent_role_id from public.roles where name = 'Agent';
    if v_agent_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (p_user_id, v_agent_role_id)
      on conflict do nothing;
    end if;
  end if;
end;
$$;
