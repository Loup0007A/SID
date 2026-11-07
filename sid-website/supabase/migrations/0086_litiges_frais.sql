-- =====================================================================
-- Lot 69 (3/3) : objets transférés à une entreprise, frais d'entreprise,
-- litiges et amendes. Rejouable. À lancer après 0085.
--
-- OBJET → ENTREPRISE
--   Le créateur d'un objet vendu en son nom peut le passer au nom d'une de
--   ses entreprises : les ventes suivantes vont à la trésorerie. Sans
--   retour possible (sinon le chiffre d'affaires se déplacerait à volonté).
--   La colonne shop_items.business_id ne se modifie plus à la main.
--
-- FRAIS D'ENTREPRISE
--   Le fondateur ou un employé demande qu'un achat de la boutique soit payé
--   par la trésorerie, avec un motif. La somme est mise de côté tout de
--   suite. Un admin « Économie » valide (l'achat est passé au prix du jour,
--   l'objet va au demandeur) ou refuse (la somme revient). Interdit :
--   acheter un objet de sa propre entreprise ou dont on est le vendeur.
--   Si le vendeur est le fondateur ou un employé, la demande est signalée.
--
-- LITIGES
--   Un membre ouvre un litige contre un membre ou une entreprise, avec une
--   catégorie, un objet, un exposé et une somme réclamée. Frais de dossier
--   (25 z de départ, indexés sur le cours du zéni) remboursés si le litige
--   aboutit. Les deux parties échangent dans un fil. Issues :
--   - accord : le défendeur paie la somme réclamée ;
--   - retrait par le demandeur ;
--   - décision d'un admin (« Économie » ou « Membres », non partie) :
--     fondé (somme accordée prise au défendeur, même en négatif) ou rejeté,
--     avec, au besoin, une amende pour l'une des parties.
--
-- AMENDES
--   Un admin peut infliger une amende à un membre ou à une entreprise. Elle
--   suit le circuit des impôts (0084) : à payer sous 7 jours, sinon saisie
--   avec 10 % de majoration et une faute (+10 % d'impôts pendant 2 mois).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Outils
-- ---------------------------------------------------------------------
-- Niveau des prix (1 = départ), d'après le dernier relevé.
create or replace function public._econ_level()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce((select price_index / 100.0 from public.economy_daily where price_index > 0 order by day desc limit 1), 1);
$$;

create or replace function public._is_judge(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_uid is not null and not public.is_sandbox_account(p_uid)
     and (public.has_permission(p_uid, 'manage_economy') or public.has_permission(p_uid, 'manage_users'));
$$;

insert into public.app_config (key, value) values
  ('dispute_fee_base', '25'),
  ('dispute_max_open', '3')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 1. Objet transféré à une entreprise
-- ---------------------------------------------------------------------
create or replace function public.guard_shop_item_business()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.has_permission(v_uid, 'manage_economy') then return new; end if;
  if tg_op = 'INSERT' then
    if new.business_id is not null and not exists (
      select 1 from public.businesses where id = new.business_id and founder_id = v_uid and not is_closed
    ) then
      raise exception 'Tu ne peux vendre qu''au nom de tes propres entreprises.';
    end if;
  elsif new.business_id is distinct from old.business_id then
    if old.business_id is not null or new.business_id is null or not exists (
      select 1 from public.businesses where id = new.business_id and founder_id = v_uid and not is_closed
    ) or old.created_by is distinct from v_uid then
      raise exception 'Un objet passe seulement de ton nom à celui d''une de tes entreprises.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_shop_item_business on public.shop_items;
create trigger trg_guard_shop_item_business before insert or update of business_id on public.shop_items
  for each row execute function public.guard_shop_item_business();

create or replace function public.shop_item_transfer(p_item uuid, p_business uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.shop_items;
  v_biz public.businesses;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select * into v_item from public.shop_items where id = p_item for update;
  if v_item.id is null then raise exception 'Objet introuvable.'; end if;
  if v_item.created_by is distinct from v_uid then raise exception 'Seul le créateur de l''objet peut le transférer.'; end if;
  if v_item.business_id is not null then raise exception 'Cet objet est déjà vendu par une entreprise.'; end if;
  select * into v_biz from public.businesses where id = p_business;
  if v_biz.id is null or v_biz.is_closed then raise exception 'Entreprise introuvable ou fermée.'; end if;
  if v_biz.founder_id is distinct from v_uid then raise exception 'Tu n''es pas le fondateur de cette entreprise.'; end if;

  update public.shop_items set business_id = p_business where id = p_item;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business, 0, 'Objet repris par l''entreprise : ' || v_item.name, v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Frais d'entreprise
-- ---------------------------------------------------------------------
alter table public.purchases add column if not exists paid_by_business uuid references public.businesses(id) on delete set null;

create table if not exists public.expense_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.shop_items(id) on delete set null,
  item_name text not null,
  quantity int not null check (quantity between 1 and 999),
  unit_price numeric(15, 2) not null check (unit_price >= 0),
  reserved numeric(18, 2) not null check (reserved >= 0),
  motive text not null check (char_length(motive) between 3 and 300),
  related boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  purchase_id uuid references public.purchases(id) on delete set null,
  paid numeric(18, 2),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists expense_requests_status_idx on public.expense_requests (status, created_at);
create index if not exists expense_requests_business_idx on public.expense_requests (business_id, created_at desc);
create index if not exists expense_requests_requester_idx on public.expense_requests (requester_id, created_at desc);

alter table public.expense_requests enable row level security;
drop policy if exists "expense_requests_select" on public.expense_requests;
create policy "expense_requests_select" on public.expense_requests for select to authenticated
  using (requester_id = auth.uid()
         or exists (select 1 from public.businesses b where b.id = business_id and b.founder_id = auth.uid())
         or public.has_permission(auth.uid(), 'manage_economy'));
revoke all on public.expense_requests from anon;
revoke insert, update, delete on public.expense_requests from authenticated;
grant select on public.expense_requests to authenticated;

create or replace function public._item_unit_price(v_item public.shop_items)
returns numeric
language sql stable
as $$
  select case when v_item.sale_price is not null and (v_item.sale_ends_at is null or v_item.sale_ends_at > now())
              then v_item.sale_price else v_item.price end;
$$;

create or replace function public.expense_request(p_business uuid, p_item uuid, p_quantity int, p_motive text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_biz public.businesses;
  v_item public.shop_items;
  v_motive text := nullif(trim(coalesce(p_motive, '')), '');
  v_unit numeric(15, 2);
  v_total numeric(18, 2);
  v_related boolean;
  v_nick text;
  v_label text;
  v_id uuid;
  v_admin uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if coalesce(p_quantity, 0) < 1 or p_quantity > 999 then raise exception 'Quantité invalide.'; end if;
  if v_motive is null or char_length(v_motive) < 3 then raise exception 'Indique le motif de la dépense.'; end if;
  if char_length(v_motive) > 300 then raise exception 'Le motif est limité à 300 caractères.'; end if;
  if not public.is_feature_enabled('shop') then raise exception 'La boutique est temporairement fermée par l''administration.'; end if;

  select * into v_biz from public.businesses where id = p_business for update;
  if v_biz.id is null or v_biz.is_closed then raise exception 'Entreprise introuvable ou fermée.'; end if;
  if not (v_biz.founder_id = v_uid or exists (select 1 from public.business_employees where business_id = p_business and user_id = v_uid)) then
    raise exception 'Seuls le fondateur et les employés demandent des frais.';
  end if;

  select * into v_item from public.shop_items where id = p_item and is_active and hidden_at is null;
  if v_item.id is null then raise exception 'Objet introuvable ou indisponible.'; end if;
  if v_item.business_id = p_business then raise exception 'Une entreprise n''achète pas ses propres objets.'; end if;
  if v_item.business_id is null and v_item.created_by = v_uid then raise exception 'Tu ne peux pas te faire rembourser ton propre objet.'; end if;
  if v_item.stock is not null and v_item.stock < p_quantity then raise exception 'Stock insuffisant.'; end if;
  if (select count(*) from public.expense_requests where requester_id = v_uid and status = 'pending') >= 5 then
    raise exception 'Tu as déjà 5 demandes en attente.';
  end if;

  v_unit := public._item_unit_price(v_item);
  v_total := v_unit * p_quantity;
  if v_total <= 0 then raise exception 'Cet objet est gratuit : achète-le directement.'; end if;
  if v_biz.treasury_balance < v_total then raise exception 'Trésorerie insuffisante.'; end if;

  -- Vendeur lié à l'entreprise (fondateur, employé, ou objet de l'une de ses entreprises) : signalé.
  v_related := (v_item.business_id is null and (v_item.created_by = v_biz.founder_id
                 or exists (select 1 from public.business_employees e where e.business_id = p_business and e.user_id = v_item.created_by)))
            or (v_item.business_id is not null and exists (
                 select 1 from public.businesses o where o.id = v_item.business_id
                 and (o.founder_id = v_biz.founder_id
                      or exists (select 1 from public.business_employees e where e.business_id = p_business and e.user_id = o.founder_id))));

  v_label := v_item.name || case when p_quantity > 1 then ' × ' || p_quantity else '' end;
  update public.businesses set treasury_balance = treasury_balance - v_total where id = p_business;
  insert into public.expense_requests (business_id, requester_id, item_id, item_name, quantity, unit_price, reserved, motive, related)
  values (p_business, v_uid, p_item, v_item.name, p_quantity, v_unit, v_total, v_motive, v_related)
  returning id into v_id;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business, -v_total, 'Frais d''entreprise (en attente) : ' || v_label, v_uid);

  select nickname into v_nick from public.profiles where id = v_uid;
  if v_biz.founder_id is not null and v_biz.founder_id <> v_uid then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_biz.founder_id, 'business', 'Frais demandés : ' || v_biz.name,
            coalesce(v_nick, 'Un employé') || ' demande ' || v_label || ' (' || public._fmt_z(v_total) || ' z) : « ' || v_motive || ' ».',
            '/dashboard/business#frais');
  end if;
  for v_admin in
    select p.id from public.profiles p
    where p.status = 'active' and not public.is_sandbox_account(p.id) and public.has_permission(p.id, 'manage_economy')
  loop
    perform public._notify_grouped(v_admin, 'admin_alert', 'frais', 'Frais d''entreprise à valider',
                                   v_biz.name || ' : ' || v_label || ' (' || public._fmt_z(v_total) || ' z)', v_total,
                                   'demandes à valider', '/dashboard/admin/economy#frais');
  end loop;
  return v_id;
end;
$$;

-- Remet la somme réservée en trésorerie.
create or replace function public._expense_restore(r public.expense_requests, p_word text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.businesses set treasury_balance = treasury_balance + r.reserved where id = r.business_id;
  if found then
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (r.business_id, r.reserved, 'Frais d''entreprise ' || p_word || ' : ' || r.item_name || ', somme remise', auth.uid());
  end if;
end;
$$;

create or replace function public.expense_cancel(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.expense_requests;
begin
  update public.expense_requests x set status = 'cancelled', decided_at = now()
  where x.id = p_id and x.status = 'pending'
    and (x.requester_id = auth.uid() or exists (select 1 from public.businesses b where b.id = x.business_id and b.founder_id = auth.uid()))
  returning * into r;
  if r.id is null then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  perform public._expense_restore(r, 'annulés');
end;
$$;

create or replace function public.expense_decide(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r public.expense_requests;
  v_biz public.businesses;
  v_item public.shop_items;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_unit numeric(15, 2);
  v_total numeric(18, 2);
  v_diff numeric(18, 2);
  v_rate numeric;
  v_vat numeric(18, 2);
  v_net numeric(18, 2);
  v_pid uuid;
  v_label text;
  v_who uuid;
begin
  if not public.has_permission(v_uid, 'manage_economy') or public.is_sandbox_account(v_uid) then
    raise exception 'Permission refusée : gestion de l''économie requise.';
  end if;
  if v_note is not null and char_length(v_note) > 300 then raise exception 'Le motif est limité à 300 caractères.'; end if;

  select * into r from public.expense_requests where id = p_id for update;
  if r.id is null or r.status <> 'pending' then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  select * into v_biz from public.businesses where id = r.business_id for update;
  if (r.requester_id = v_uid or v_biz.founder_id = v_uid) and exists (
    select 1 from public.profiles p
    where p.id <> v_uid and p.status = 'active' and not public.is_sandbox_account(p.id)
      and public.has_permission(p.id, 'manage_economy')
  ) then
    raise exception 'Un autre admin doit valider les frais de ton entreprise.';
  end if;
  v_label := r.item_name || case when r.quantity > 1 then ' × ' || r.quantity else '' end;

  if not coalesce(p_approve, false) then
    update public.expense_requests set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_note = v_note where id = r.id;
    perform public._expense_restore(r, 'refusés');
    for v_who in select distinct u from unnest(array[r.requester_id, v_biz.founder_id]) u where u is not null loop
      insert into public.notifications (user_id, type, title, body, link)
      values (v_who, 'business', 'Frais refusés : ' || coalesce(v_biz.name, 'entreprise'),
              v_label || ' : ' || public._fmt_z(r.reserved) || ' z remis en trésorerie' || coalesce(' — ' || v_note, '.'),
              '/dashboard/business#frais');
    end loop;
    perform public.write_audit('expense_rejected', r.requester_id, jsonb_build_object('montant', r.reserved, 'entreprise', v_biz.name, 'motif', v_note));
    return;
  end if;

  if v_biz.id is null or v_biz.is_closed then raise exception 'L''entreprise est fermée : refuse la demande.'; end if;
  select * into v_item from public.shop_items where id = r.item_id and is_active and hidden_at is null for update;
  if v_item.id is null then raise exception 'L''objet n''est plus en vente : refuse la demande.'; end if;
  if v_item.stock is not null and v_item.stock < r.quantity then raise exception 'Stock insuffisant : refuse la demande.'; end if;

  -- Prix du jour ; l'écart avec la somme réservée est réglé sur la trésorerie.
  v_unit := public._item_unit_price(v_item);
  v_total := v_unit * r.quantity;
  v_diff := r.reserved - v_total;
  if v_diff < 0 and v_biz.treasury_balance < -v_diff then
    raise exception 'Le prix a augmenté et la trésorerie ne couvre pas l''écart : refuse la demande.';
  end if;
  if v_diff <> 0 then
    update public.businesses set treasury_balance = treasury_balance + v_diff where id = v_biz.id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (v_biz.id, v_diff, 'Frais d''entreprise : écart de prix sur ' || v_label, v_uid);
  end if;

  v_rate := public.get_config_numeric('vat_rate', 0.05);
  v_vat := round(v_total * v_rate, 2);
  v_net := v_total - v_vat;

  insert into public.purchases (item_id, user_id, quantity, total_price, status, paid_by_business)
  values (v_item.id, r.requester_id, r.quantity, v_total, 'pending', v_biz.id)
  returning id into v_pid;

  if v_item.business_id is not null then
    update public.businesses set treasury_balance = treasury_balance + v_net where id = v_item.business_id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (v_item.business_id, v_net, 'Vente : ' || v_item.name || ' (TVA déduite)', r.requester_id);
  elsif v_item.created_by is not null then
    update public.wallets set balance = balance + v_net where user_id = v_item.created_by;
    insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
    values (v_item.created_by, v_net, 'Vente : ' || v_item.name || ' (TVA ' || (v_rate * 100)::text || '% déduite)', v_pid, r.requester_id);
  end if;
  update public.tax_pool set balance = balance + v_vat where id = true;
  if v_item.stock is not null then
    update public.shop_items set stock = stock - r.quantity where id = v_item.id;
  end if;

  update public.expense_requests
  set status = 'approved', decided_by = v_uid, decided_at = now(), decision_note = v_note, purchase_id = v_pid, paid = v_total
  where id = r.id;

  for v_who in select distinct u from unnest(array[r.requester_id, v_biz.founder_id]) u where u is not null loop
    insert into public.notifications (user_id, type, title, body, link)
    values (v_who, 'business', 'Frais validés : ' || v_biz.name,
            v_label || ' payé par la trésorerie (' || public._fmt_z(v_total) || ' z)'
            || case when v_who = r.requester_id then ', l''objet est dans tes achats.' else '.' end,
            case when v_who = r.requester_id then '/dashboard/shop?onglet=achats' else '/dashboard/business#frais' end);
  end loop;
  perform public.write_audit('expense_approved', r.requester_id, jsonb_build_object('montant', v_total, 'entreprise', v_biz.name, 'objet', v_label));
end;
$$;

-- p_scope : 'mine' (mes demandes), 'business' (celles d'une entreprise que
-- je dirige), 'pending' / 'recent' (admins).
create or replace function public.expenses_list(p_scope text default 'mine', p_business uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.has_permission(auth.uid(), 'manage_economy');
begin
  if v_uid is null then return '[]'::jsonb; end if;
  if p_scope in ('pending', 'recent') and not v_admin then raise exception 'Permission refusée.'; end if;
  if p_scope = 'business' and not (v_admin or exists (
       select 1 from public.businesses where id = p_business and founder_id = v_uid)) then
    raise exception 'Permission refusée.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'business_id', x.business_id, 'business_name', b.name,
             'requester_id', x.requester_id, 'requester', p.nickname,
             'item_id', x.item_id, 'item_name', x.item_name, 'image_url', i.image_url,
             'seller', coalesce(sb.name, sp.nickname),
             'quantity', x.quantity, 'unit_price', x.unit_price, 'reserved', x.reserved, 'paid', x.paid,
             'current_price', case when x.status = 'pending' and i.id is not null then public._item_unit_price(i) * x.quantity end,
             'motive', x.motive, 'related', x.related, 'status', x.status,
             'created_at', x.created_at, 'decided_at', x.decided_at, 'decided_by', d.nickname, 'note', x.decision_note,
             'treasury', case when p_scope = 'pending' then b.treasury_balance end,
             'self', x.requester_id = v_uid or b.founder_id = v_uid
           ) order by case when x.status = 'pending' then 0 else 1 end, x.created_at desc)
    from (
      select * from public.expense_requests r
      where case p_scope
              when 'mine' then r.requester_id = v_uid and (r.status = 'pending' or r.created_at > now() - interval '30 days')
              when 'business' then r.business_id = p_business and (r.status = 'pending' or r.created_at > now() - interval '60 days')
              when 'pending' then r.status = 'pending'
              else r.status <> 'pending' and r.decided_at > now() - interval '30 days'
            end
      order by r.created_at desc
      limit 200
    ) x
    join public.businesses b on b.id = x.business_id
    left join public.profiles p on p.id = x.requester_id
    left join public.profiles d on d.id = x.decided_by
    left join public.shop_items i on i.id = x.item_id
    left join public.businesses sb on sb.id = i.business_id
    left join public.profiles sp on sp.id = i.created_by
  ), '[]'::jsonb);
end;
$$;

-- Frais en attente d'une entreprise qui ferme : annulés, somme remise en
-- trésorerie avant la répartition.
create or replace function public._expense_cancel_pending(p_business uuid, p_word text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.expense_requests;
begin
  for r in
    update public.expense_requests set status = 'cancelled', decided_at = now(), decision_note = 'Entreprise fermée'
    where business_id = p_business and status = 'pending'
    returning *
  loop
    perform public._expense_restore(r, p_word);
  end loop;
end;
$$;

-- Fermeture volontaire (0082) : + frais en attente, + part de la population.
create or replace function public.close_business(p_business_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_business public.businesses;
  v_public_shares int;
  v_per_share numeric(18, 6);
  r record;
  w public.withdrawal_requests;
begin
  select * into v_business from public.businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'Entreprise introuvable';
  end if;
  if not (v_business.founder_id = auth.uid() or public.has_permission(auth.uid(), 'manage_economy')) then
    raise exception 'Permission refusée';
  end if;
  if v_business.is_closed then
    raise exception 'Cette entreprise est déjà fermée.';
  end if;
  if v_business.debt_principal > 0 then
    raise exception 'Rembourse d''abord les emprunts de l''entreprise avant de la fermer.';
  end if;

  for w in select * from public.withdrawal_requests where business_id = p_business_id and status = 'pending' for update loop
    update public.withdrawal_requests set status = 'cancelled', decided_at = now(), decision_note = 'Entreprise fermée' where id = w.id;
    perform public._withdrawal_restore(w, 'annulé (fermeture)');
  end loop;
  perform public._expense_cancel_pending(p_business_id, 'annulés (fermeture)');
  select * into v_business from public.businesses where id = p_business_id;

  v_public_shares := v_business.share_count - v_business.shares_in_treasury;

  if v_public_shares > 0 and v_business.treasury_balance > 0 then
    v_per_share := v_business.treasury_balance / v_public_shares;
    for r in select * from public.business_shareholders where business_id = p_business_id and quantity > 0 loop
      update public.wallets set balance = balance + round(v_per_share * r.quantity, 2) where user_id = r.user_id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (r.user_id, round(v_per_share * r.quantity, 2), 'Liquidation : ' || v_business.name, auth.uid());
    end loop;
    -- La population reçoit aussi sa part (0086).
    update public.sim_agents a set balance = a.balance + round(v_per_share * s.quantity, 2)
    from public.sim_shareholdings s
    where s.business_id = p_business_id and s.quantity > 0 and a.id = s.agent_id;
  end if;

  update public.businesses
    set is_closed = true, treasury_balance = 0, shares_in_treasury = share_count,
        closed_at = now(), closed_reason = 'liquidation'
    where id = p_business_id;

  delete from public.business_shareholders where business_id = p_business_id;
  delete from public.sim_shareholdings where business_id = p_business_id;
  delete from public.business_share_lots where business_id = p_business_id;
  delete from public.business_employees where business_id = p_business_id;

  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_business_id, 0, 'Entreprise fermée / liquidée', auth.uid());
end;
$$;

-- Faillite (0082) : + frais en attente.
create or replace function public._business_bankrupt(p_id uuid, p_revenue numeric, p_minimum numeric)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  b public.businesses;
  w public.withdrawal_requests;
  a record;
  r record;
  v_cash numeric(18, 2);
  v_debt numeric(18, 2);
  v_total int;
  v_part numeric(18, 2);
  v_paid numeric(18, 2) := 0;
  v_parts jsonb := '{}'::jsonb;
  v_why text;
  v_uid uuid;
begin
  select * into b from public.businesses where id = p_id for update;
  if b.id is null or b.is_closed then return 0; end if;

  -- 1. Retraits, frais d'entreprise en attente et enchères en cours : annulés.
  for w in select * from public.withdrawal_requests where business_id = p_id and status = 'pending' for update loop
    update public.withdrawal_requests set status = 'cancelled', decided_at = now(), decision_note = 'Faillite de l''entreprise' where id = w.id;
    perform public._withdrawal_restore(w, 'annulé (faillite)');
  end loop;
  perform public._expense_cancel_pending(p_id, 'annulés (faillite)');

  for a in select * from public.auctions where business_id = p_id and status = 'open' for update loop
    if a.top_bidder is not null and a.current_price is not null then
      perform public._auction_refund(a.top_bidder, a.current_price, 'Enchère annulée : faillite du vendeur (remboursement)');
      perform public._auction_notify(a.top_bidder, 'Enchère annulée', 'Le vendeur a fait faillite : ton offre t''est rendue.', a.id);
    end if;
    if a.purchase_id is null then
      update public.shop_items set stock = stock + a.quantity where id = a.item_id and stock is not null;
    end if;
    update public.auctions set status = 'cancelled', settled_at = now() where id = a.id;
  end loop;

  select * into b from public.businesses where id = p_id;

  -- 2. La dette d'abord.
  v_cash := greatest(b.treasury_balance, 0);
  v_debt := least(v_cash, greatest(b.debt_principal, 0));
  v_cash := v_cash - v_debt;

  -- 3. Le reste aux actionnaires, au prorata.
  v_total := coalesce((select sum(quantity) from public.business_shareholders where business_id = p_id and quantity > 0), 0)
           + coalesce((select sum(quantity) from public.sim_shareholdings where business_id = p_id and quantity > 0), 0);

  if v_cash > 0 and v_total > 0 then
    for r in select user_id, quantity from public.business_shareholders where business_id = p_id and quantity > 0 loop
      v_part := trunc(v_cash * r.quantity / v_total, 2);
      if v_part > 0 then
        update public.wallets set balance = balance + v_part where user_id = r.user_id;
        insert into public.transactions (user_id, amount, reason, created_by)
        values (r.user_id, v_part, 'Faillite : ' || b.name || ' (part d''actionnaire)', null);
        v_paid := v_paid + v_part;
      end if;
      v_parts := v_parts || jsonb_build_object(r.user_id::text, v_part);
    end loop;
    for r in select agent_id, quantity from public.sim_shareholdings where business_id = p_id and quantity > 0 loop
      v_part := trunc(v_cash * r.quantity / v_total, 2);
      update public.sim_agents set balance = balance + v_part where id = r.agent_id;
      v_paid := v_paid + v_part;
    end loop;
  end if;
  -- Centimes d'arrondi, ou tout s'il n'y a aucun actionnaire : caisse commune.
  if v_cash - v_paid > 0 then
    update public.tax_pool set balance = balance + (v_cash - v_paid) where id = true;
  end if;

  -- 4. Fermeture.
  v_why := 'chiffre d''affaires de la semaine ' || public._fmt_z(p_revenue) || ' z sur ' || public._fmt_z(p_minimum) || ' z requis';
  update public.businesses
    set is_closed = true, treasury_balance = 0, debt_principal = 0, shares_in_treasury = share_count,
        closed_at = now(), closed_reason = 'faillite'
    where id = p_id;
  update public.shop_items set is_active = false where business_id = p_id;
  insert into public.business_transactions (business_id, amount, reason, created_by)
  values (p_id, 0, 'Faillite : ' || v_why
                   || case when v_debt > 0 then ', dette remboursée ' || public._fmt_z(v_debt) || ' z' else '' end
                   || ', ' || public._fmt_z(v_cash) || ' z répartis', null);

  -- 5. Le fondateur et les actionnaires sont prévenus.
  for v_uid in
    select b.founder_id
    union
    select user_id from public.business_shareholders where business_id = p_id and quantity > 0
  loop
    insert into public.notifications (user_id, type, title, body, link)
    select v_uid, 'business', 'Faillite : ' || b.name,
           upper(left(v_why, 1)) || substr(v_why, 2) || '.'
           || case when (v_parts ? v_uid::text) then ' Ta part : +' || public._fmt_z((v_parts->>v_uid::text)::numeric) || ' z.' else '' end,
           '/dashboard/business'
    where exists (select 1 from public.profiles where id = v_uid);
  end loop;

  delete from public.business_shareholders where business_id = p_id;
  delete from public.sim_shareholdings where business_id = p_id;
  delete from public.business_share_lots where business_id = p_id;
  delete from public.business_employees where business_id = p_id;
  return v_cash;
end;
$$;


drop trigger if exists trg_expense_on_close on public.businesses;
drop function if exists public._expense_on_close();

-- ---------------------------------------------------------------------
-- 3. Amendes
-- ---------------------------------------------------------------------
alter table public.tax_bills add column if not exists dispute_id uuid;

create or replace function public._fine_create(p_user uuid, p_business uuid, p_amount numeric, p_reason text, p_dispute uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_due timestamptz := now() + make_interval(days => public.get_config_numeric('tax_due_days', 7)::int);
  v_id uuid;
  v_biz text;
begin
  insert into public.tax_bills (kind, user_id, business_id, period_start, period_end, base, rate, amount, due_at, reason, issued_by, dispute_id)
  values ('amende', p_user, p_business, now(), now(), p_amount, 1, p_amount, v_due, p_reason, auth.uid(), p_dispute)
  returning id into v_id;
  select name into v_biz from public.businesses where id = p_business;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, 'tax', 'Amende' || coalesce(' : ' || v_biz, ''),
          public._fmt_z(p_amount) || ' z à payer avant le ' || to_char(v_due at time zone public.stats_timezone(), 'DD/MM')
          || case when p_business is not null then ' depuis la trésorerie' else '' end || ' — ' || p_reason || '.',
          case when p_business is null then '/dashboard/bank#impots' else '/dashboard/business#impots' end);
  return v_id;
end;
$$;

create or replace function public.fine_issue(p_user uuid, p_business uuid, p_amount numeric, p_reason text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_user uuid := p_user;
  v_biz public.businesses;
  v_id uuid;
begin
  if not public._is_judge(v_uid) then raise exception 'Permission refusée.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Montant invalide.'; end if;
  if v_reason is null or char_length(v_reason) < 3 then raise exception 'Indique le motif de l''amende.'; end if;
  if char_length(v_reason) > 300 then raise exception 'Le motif est limité à 300 caractères.'; end if;
  if p_business is not null then
    select * into v_biz from public.businesses where id = p_business;
    if v_biz.id is null or v_biz.is_closed or v_biz.founder_id is null then raise exception 'Entreprise introuvable ou fermée.'; end if;
    v_user := v_biz.founder_id;
  end if;
  if v_user is null or not exists (select 1 from public.profiles where id = v_user and status = 'active') then
    raise exception 'Membre introuvable.';
  end if;
  if v_user = v_uid then raise exception 'Tu ne peux pas te mettre une amende.'; end if;
  v_id := public._fine_create(v_user, p_business, round(p_amount, 2), v_reason, null);
  perform public.write_audit('fine_issued', v_user, jsonb_build_object('montant', round(p_amount, 2), 'entreprise', v_biz.name, 'motif', v_reason));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Litiges
-- ---------------------------------------------------------------------
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  against_user uuid references public.profiles(id) on delete set null,
  against_business uuid references public.businesses(id) on delete set null,
  defendant_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('paiement', 'livraison', 'contrat', 'degats', 'escroquerie', 'autre')),
  subject text not null check (char_length(subject) between 3 and 120),
  claimed numeric(18, 2) not null default 0 check (claimed >= 0),
  fee numeric(18, 2) not null default 0,
  status text not null default 'open' check (status in ('open', 'settled', 'upheld', 'rejected', 'withdrawn')),
  award numeric(18, 2) not null default 0,
  fine numeric(18, 2) not null default 0,
  fine_target text check (fine_target is null or fine_target in ('demandeur', 'defendeur')),
  decision text check (decision is null or char_length(decision) <= 1000),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (against_user is not null or against_business is not null)
);
create index if not exists disputes_status_idx on public.disputes (status, last_activity_at desc);
create index if not exists disputes_opened_idx on public.disputes (opened_by, created_at desc);
create index if not exists disputes_defendant_idx on public.disputes (defendant_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tax_bills_dispute_fk') then
    alter table public.tax_bills add constraint tax_bills_dispute_fk foreign key (dispute_id) references public.disputes(id) on delete set null;
  end if;
end;
$$;

create table if not exists public.dispute_messages (
  id bigint generated always as identity primary key,
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'message' check (kind in ('message', 'event')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists dispute_messages_idx on public.dispute_messages (dispute_id, created_at);

alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
drop policy if exists "disputes_select" on public.disputes;
create policy "disputes_select" on public.disputes for select to authenticated
  using (opened_by = auth.uid() or defendant_id = auth.uid() or public._is_judge(auth.uid()));
drop policy if exists "dispute_messages_select" on public.dispute_messages;
create policy "dispute_messages_select" on public.dispute_messages for select to authenticated
  using (exists (select 1 from public.disputes d where d.id = dispute_id
                 and (d.opened_by = auth.uid() or d.defendant_id = auth.uid() or public._is_judge(auth.uid()))));
revoke all on public.disputes, public.dispute_messages from anon;
revoke insert, update, delete on public.disputes, public.dispute_messages from authenticated;
grant select on public.disputes, public.dispute_messages to authenticated;

create or replace function public.dispute_fee()
returns numeric
language sql stable security definer set search_path = public
as $$
  select greatest(0, round(public.get_config_numeric('dispute_fee_base', 25) * public._econ_level(), 0))::numeric(18, 2);
$$;

-- Prévient les parties (sauf l'auteur) et, au besoin, les juges.
create or replace function public._dispute_notify(d public.disputes, p_line text, p_judges boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_who uuid;
  v_title text := 'Litige n° ' || d.number || ' : ' || d.subject;
begin
  for v_who in
    select distinct u from (
      select unnest(array[d.opened_by, d.defendant_id]) u
      union all
      select p.id from public.profiles p
      where p_judges and p.status = 'active' and public._is_judge(p.id)
    ) x
    where u is not null and u is distinct from auth.uid()
  loop
    perform public._notify_grouped(v_who, 'dispute', 'litige:' || d.id, v_title, p_line, null, 'nouvelles',
                                   '/dashboard/litiges?litige=' || d.id);
  end loop;
end;
$$;

create or replace function public._dispute_event(p_dispute uuid, p_body text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.dispute_messages (dispute_id, author_id, kind, body) values (p_dispute, auth.uid(), 'event', p_body);
  update public.disputes set last_activity_at = now() where id = p_dispute;
$$;

create or replace function public.dispute_open(p_against_user uuid, p_against_business uuid, p_category text,
                                               p_subject text, p_body text, p_claimed numeric default 0)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_subject text := nullif(trim(coalesce(p_subject, '')), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_claimed numeric(18, 2) := round(greatest(coalesce(p_claimed, 0), 0), 2);
  v_biz public.businesses;
  v_def uuid;
  v_fee numeric(18, 2) := public.dispute_fee();
  v_bal numeric;
  d public.disputes;
  v_nick text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then raise exception 'Ton compte est gelé.'; end if;
  if (p_against_user is null) = (p_against_business is null) then raise exception 'Choisis un membre ou une entreprise.'; end if;
  if p_category is null or p_category not in ('paiement', 'livraison', 'contrat', 'degats', 'escroquerie', 'autre') then
    raise exception 'Catégorie inconnue.';
  end if;
  if v_subject is null or char_length(v_subject) < 3 or char_length(v_subject) > 120 then raise exception 'L''objet doit faire entre 3 et 120 caractères.'; end if;
  if v_body is null or char_length(v_body) < 20 then raise exception 'Expose les faits (20 caractères au moins).'; end if;
  if char_length(v_body) > 2000 then raise exception 'L''exposé est limité à 2 000 caractères.'; end if;
  if v_claimed > 10000000 then raise exception 'Somme réclamée trop élevée.'; end if;

  if p_against_business is not null then
    select * into v_biz from public.businesses where id = p_against_business;
    if v_biz.id is null or v_biz.is_closed then raise exception 'Entreprise introuvable ou fermée.'; end if;
    v_def := v_biz.founder_id;
  else
    if not exists (select 1 from public.profiles where id = p_against_user and status = 'active') then raise exception 'Membre introuvable.'; end if;
    v_def := p_against_user;
  end if;
  if v_def is null then raise exception 'Cette entreprise n''a pas de fondateur.'; end if;
  if v_def = v_uid then raise exception 'Tu ne peux pas ouvrir un litige contre toi-même.'; end if;
  if public.is_sandbox_account(v_def) and not public.is_sandbox_account(v_uid) then raise exception 'Ce compte est un compte de test.'; end if;
  if (select count(*) from public.disputes where opened_by = v_uid and status = 'open')
     >= public.get_config_numeric('dispute_max_open', 3) then
    raise exception 'Tu as déjà % litiges ouverts.', public.get_config_numeric('dispute_max_open', 3)::int;
  end if;

  if v_fee > 0 then
    select balance into v_bal from public.wallets where user_id = v_uid for update;
    if coalesce(v_bal, 0) < v_fee then raise exception 'Frais de dossier : % z nécessaires.', public._fmt_z(v_fee); end if;
    update public.wallets set balance = balance - v_fee where user_id = v_uid;
    update public.tax_pool set balance = balance + v_fee where id = true;
  end if;

  insert into public.disputes (opened_by, against_user, against_business, defendant_id, category, subject, claimed, fee)
  values (v_uid, case when p_against_business is null then p_against_user end, p_against_business, v_def, p_category, v_subject, v_claimed, v_fee)
  returning * into d;
  if v_fee > 0 then
    insert into public.transactions (user_id, amount, reason, created_by)
    values (v_uid, -v_fee, 'Litige n° ' || d.number || ' : frais de dossier', v_uid);
  end if;
  insert into public.dispute_messages (dispute_id, author_id, body) values (d.id, v_uid, v_body);

  select nickname into v_nick from public.profiles where id = v_uid;
  perform public._dispute_notify(d,
    coalesce(v_nick, 'Un membre') || ' ouvre un litige' || coalesce(' contre ' || v_biz.name, '')
    || case when v_claimed > 0 then ' et réclame ' || public._fmt_z(v_claimed) || ' z' else '' end || '.', true);
  return d.id;
end;
$$;

create or replace function public.dispute_post(p_dispute uuid, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  d public.disputes;
  v_nick text;
  v_judge boolean := public._is_judge(auth.uid());
begin
  select * into d from public.disputes where id = p_dispute for update;
  if d.id is null or not (d.opened_by = v_uid or d.defendant_id = v_uid or v_judge) then raise exception 'Litige introuvable.'; end if;
  if d.status <> 'open' then raise exception 'Ce litige est clos.'; end if;
  if v_body is null then raise exception 'Message vide.'; end if;
  if char_length(v_body) > 2000 then raise exception 'Le message est limité à 2 000 caractères.'; end if;
  if (select count(*) from public.dispute_messages where dispute_id = d.id and author_id = v_uid and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Trop de messages : attends une minute.';
  end if;
  insert into public.dispute_messages (dispute_id, author_id, body) values (d.id, v_uid, v_body);
  update public.disputes set last_activity_at = now() where id = d.id;
  select nickname into v_nick from public.profiles where id = v_uid;
  perform public._dispute_notify(d, coalesce(v_nick, 'Un membre') || ' : ' || left(v_body, 140), false);
end;
$$;

-- Accord : le défendeur paie la somme réclamée (trésorerie s'il s'agit d'une entreprise).
create or replace function public.dispute_accept(p_dispute uuid, p_source text default 'portefeuille')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d public.disputes;
  v_bal numeric;
  v_biz public.businesses;
begin
  select * into d from public.disputes where id = p_dispute for update;
  if d.id is null or d.defendant_id is distinct from v_uid then raise exception 'Seul le défendeur peut accepter.'; end if;
  if d.status <> 'open' then raise exception 'Ce litige est clos.'; end if;

  if d.claimed > 0 then
    if d.against_business is not null then
      select * into v_biz from public.businesses where id = d.against_business for update;
      if v_biz.id is null or v_biz.is_closed then raise exception 'Entreprise introuvable ou fermée.'; end if;
      if v_biz.treasury_balance < d.claimed then raise exception 'Trésorerie insuffisante.'; end if;
      update public.businesses set treasury_balance = treasury_balance - d.claimed where id = v_biz.id;
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (v_biz.id, -d.claimed, 'Litige n° ' || d.number || ' : accord', v_uid);
    else
      select balance into v_bal from public.wallets where user_id = v_uid for update;
      if coalesce(v_bal, 0) < d.claimed then raise exception 'Solde insuffisant.'; end if;
      update public.wallets set balance = balance - d.claimed where user_id = v_uid;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (v_uid, -d.claimed, 'Litige n° ' || d.number || ' : accord', v_uid);
    end if;
    update public.wallets set balance = balance + d.claimed where user_id = d.opened_by;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (d.opened_by, d.claimed, 'Litige n° ' || d.number || ' : accord', v_uid);
  end if;
  perform public._dispute_refund_fee(d);

  update public.disputes set status = 'settled', award = d.claimed, decided_at = now(), last_activity_at = now() where id = d.id;
  perform public._dispute_event(d.id, 'Accord : le défendeur accepte' || case when d.claimed > 0 then ' et verse ' || public._fmt_z(d.claimed) || ' z' else '' end || '.');
  perform public._dispute_notify(d, 'Accord trouvé' || case when d.claimed > 0 then ' : ' || public._fmt_z(d.claimed) || ' z versés' else '' end || '.', true);
end;
$$;

create or replace function public._dispute_refund_fee(d public.disputes)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if d.fee <= 0 then return; end if;
  update public.tax_pool set balance = balance - d.fee where id = true;
  update public.wallets set balance = balance + d.fee where user_id = d.opened_by;
  insert into public.transactions (user_id, amount, reason, created_by)
  values (d.opened_by, d.fee, 'Litige n° ' || d.number || ' : frais de dossier remboursés', auth.uid());
end;
$$;

create or replace function public.dispute_withdraw(p_dispute uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  d public.disputes;
begin
  update public.disputes set status = 'withdrawn', decided_at = now(), last_activity_at = now()
  where id = p_dispute and opened_by = auth.uid() and status = 'open'
  returning * into d;
  if d.id is null then raise exception 'Litige introuvable ou clos.'; end if;
  perform public._dispute_event(d.id, 'Le demandeur retire sa plainte.');
  perform public._dispute_notify(d, 'Le demandeur retire sa plainte.', true);
end;
$$;

-- Décision d'un juge (admin « Économie » ou « Membres », non partie).
create or replace function public.dispute_decide(p_dispute uuid, p_upheld boolean, p_award numeric default 0,
                                                 p_fine numeric default 0, p_fine_target text default null,
                                                 p_decision text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d public.disputes;
  v_award numeric(18, 2) := round(greatest(coalesce(p_award, 0), 0), 2);
  v_fine numeric(18, 2) := round(greatest(coalesce(p_fine, 0), 0), 2);
  v_text text := nullif(trim(coalesce(p_decision, '')), '');
  v_fined uuid;
  v_fine_biz uuid;
  v_event text;
begin
  if not public._is_judge(v_uid) then raise exception 'Permission refusée.'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if d.id is null then raise exception 'Litige introuvable.'; end if;
  if d.status <> 'open' then raise exception 'Ce litige est clos.'; end if;
  if v_uid in (d.opened_by, d.defendant_id) then raise exception 'Tu es partie à ce litige : un autre admin doit trancher.'; end if;
  if v_text is null or char_length(v_text) < 10 then raise exception 'Motive la décision (10 caractères au moins).'; end if;
  if char_length(v_text) > 1000 then raise exception 'La décision est limitée à 1 000 caractères.'; end if;
  if not coalesce(p_upheld, false) then v_award := 0; end if;
  if v_fine > 0 and (p_fine_target is null or p_fine_target not in ('demandeur', 'defendeur')) then
    raise exception 'Indique qui paie l''amende.';
  end if;

  -- Somme accordée : prise au défendeur, même si son solde passe en négatif.
  if v_award > 0 then
    if d.against_business is not null and exists (select 1 from public.businesses where id = d.against_business and not is_closed) then
      update public.businesses set treasury_balance = treasury_balance - v_award where id = d.against_business;
      insert into public.business_transactions (business_id, amount, reason, created_by)
      values (d.against_business, -v_award, 'Litige n° ' || d.number || ' : condamnation', v_uid);
    else
      update public.wallets set balance = balance - v_award where user_id = d.defendant_id;
      insert into public.transactions (user_id, amount, reason, created_by)
      values (d.defendant_id, -v_award, 'Litige n° ' || d.number || ' : condamnation', v_uid);
    end if;
    update public.wallets set balance = balance + v_award where user_id = d.opened_by;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (d.opened_by, v_award, 'Litige n° ' || d.number || ' : somme accordée', v_uid);
  end if;
  if coalesce(p_upheld, false) then perform public._dispute_refund_fee(d); end if;

  if v_fine > 0 then
    if p_fine_target = 'defendeur' then
      v_fined := d.defendant_id;
      v_fine_biz := case when exists (select 1 from public.businesses where id = d.against_business and not is_closed) then d.against_business end;
    else
      v_fined := d.opened_by;
    end if;
    if v_fined is not null then
      perform public._fine_create(v_fined, v_fine_biz, v_fine, 'Litige n° ' || d.number || ' : ' || d.subject, d.id);
    end if;
  end if;

  update public.disputes
  set status = case when coalesce(p_upheld, false) then 'upheld' else 'rejected' end,
      award = v_award, fine = v_fine, fine_target = case when v_fine > 0 then p_fine_target end,
      decision = v_text, decided_by = v_uid, decided_at = now(), last_activity_at = now()
  where id = d.id;

  v_event := case when coalesce(p_upheld, false) then 'Plainte fondée' else 'Plainte rejetée' end
             || case when v_award > 0 then ' : ' || public._fmt_z(v_award) || ' z accordés au demandeur' else '' end
             || case when v_fine > 0 then '. Amende de ' || public._fmt_z(v_fine) || ' z pour le '
                     || case when p_fine_target = 'defendeur' then 'défendeur' else 'demandeur' end else '' end || '.';
  insert into public.dispute_messages (dispute_id, author_id, kind, body) values (d.id, v_uid, 'event', v_event || E'\n' || v_text);
  perform public._dispute_notify(d, v_event, false);
  perform public.write_audit('dispute_decided', d.opened_by,
    jsonb_build_object('litige', d.number, 'fonde', coalesce(p_upheld, false), 'somme', v_award, 'amende', v_fine));
end;
$$;

create or replace function public._dispute_json(d public.disputes, p_messages boolean)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', d.id, 'number', d.number, 'category', d.category, 'subject', d.subject,
    'claimed', d.claimed, 'fee', d.fee, 'status', d.status, 'award', d.award, 'fine', d.fine, 'fine_target', d.fine_target,
    'decision', d.decision, 'decided_at', d.decided_at, 'decided_by', (select nickname from public.profiles where id = d.decided_by),
    'created_at', d.created_at, 'last_activity_at', d.last_activity_at,
    'opened_by', d.opened_by, 'plaintiff', (select nickname from public.profiles where id = d.opened_by),
    'plaintiff_avatar', (select avatar_url from public.profiles where id = d.opened_by),
    'defendant_id', d.defendant_id, 'defendant', (select nickname from public.profiles where id = d.defendant_id),
    'defendant_avatar', (select avatar_url from public.profiles where id = d.defendant_id),
    'business_id', d.against_business, 'business_name', (select name from public.businesses where id = d.against_business),
    'role', case when d.opened_by = auth.uid() then 'demandeur' when d.defendant_id = auth.uid() then 'defendeur' else 'juge' end,
    'messages_count', (select count(*) from public.dispute_messages m where m.dispute_id = d.id and m.kind = 'message'),
    'messages', case when p_messages then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'kind', m.kind, 'body', m.body, 'created_at', m.created_at, 'author_id', m.author_id,
               'author', p.nickname, 'avatar_url', p.avatar_url,
               'side', case when m.author_id = d.opened_by then 'demandeur' when m.author_id = d.defendant_id then 'defendeur' else 'juge' end)
             order by m.created_at, m.id)
      from public.dispute_messages m left join public.profiles p on p.id = m.author_id
      where m.dispute_id = d.id), '[]'::jsonb) end
  );
$$;

-- p_scope : 'mine' (demandeur ou défendeur), 'open' / 'closed' (juges).
create or replace function public.disputes_list(p_scope text default 'mine')
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return '[]'::jsonb; end if;
  if p_scope <> 'mine' and not public._is_judge(v_uid) then raise exception 'Permission refusée.'; end if;
  return coalesce((
    select jsonb_agg(public._dispute_json(d, false) order by case when d.status = 'open' then 0 else 1 end, d.last_activity_at desc)
    from (
      select * from public.disputes x
      where case p_scope
              when 'mine' then x.opened_by = v_uid or x.defendant_id = v_uid
              when 'open' then x.status = 'open'
              else x.status <> 'open' and x.decided_at > now() - interval '90 days'
            end
      order by x.last_activity_at desc
      limit 100
    ) d
  ), '[]'::jsonb);
end;
$$;

create or replace function public.dispute_detail(p_dispute uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  d public.disputes;
begin
  select * into d from public.disputes where id = p_dispute;
  if d.id is null or not (d.opened_by = auth.uid() or d.defendant_id = auth.uid() or public._is_judge(auth.uid())) then
    return null;
  end if;
  return public._dispute_json(d, true) || jsonb_build_object(
    'fines', coalesce((select jsonb_agg(jsonb_build_object('amount', t.amount, 'status', t.status, 'nickname', p.nickname))
                       from public.tax_bills t join public.profiles p on p.id = t.user_id where t.dispute_id = d.id), '[]'::jsonb),
    'fee_now', public.dispute_fee()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public._econ_level()', 'public._is_judge(uuid)', 'public.guard_shop_item_business()',
    'public._item_unit_price(public.shop_items)', 'public._expense_restore(public.expense_requests, text)',
    'public._expense_cancel_pending(uuid, text)', 'public._fine_create(uuid, uuid, numeric, text, uuid)',
    'public._dispute_notify(public.disputes, text, boolean)', 'public._dispute_event(uuid, text)',
    'public._dispute_refund_fee(public.disputes)', 'public._dispute_json(public.disputes, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.shop_item_transfer(uuid, uuid)', 'public.expense_request(uuid, uuid, int, text)',
    'public.expense_cancel(uuid)', 'public.expense_decide(uuid, boolean, text)', 'public.expenses_list(text, uuid)',
    'public.fine_issue(uuid, uuid, numeric, text)', 'public.dispute_fee()',
    'public.dispute_open(uuid, uuid, text, text, text, numeric)', 'public.dispute_post(uuid, text)',
    'public.dispute_accept(uuid, text)', 'public.dispute_withdraw(uuid)',
    'public.dispute_decide(uuid, boolean, numeric, numeric, text, text)',
    'public.disputes_list(text)', 'public.dispute_detail(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
