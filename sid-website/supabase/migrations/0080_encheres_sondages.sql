-- =====================================================================
-- Lot 65 : salle des ventes (enchères) et sondages de l'administration.
-- Rejouable.
--
-- ENCHÈRES
--   Deux façons de mettre un lot en jeu :
--   - « stock » : un vendeur de la boutique prélève N exemplaires d'un de
--     ses objets (stock réservé pendant la vente, rendu si rien n'est vendu) ;
--     le gagnant reçoit un achat neuf, comme s'il l'avait acheté en vitrine
--     (les objets à effet lui donnent donc bien leur effet) ;
--   - « revente » : n'importe quel membre remet en jeu une ligne de « Mes
--     achats » (sauf les objets à effet, consommés au moment de l'achat) ;
--     la ligne passe au gagnant à la fin.
--   L'offre la plus haute est bloquée tout de suite sur la bourse de
--   l'enchérisseur et rendue dès qu'il est dépassé : le gagnant ne peut pas
--   se retrouver sans le sou à la clôture. Une offre dans les 2 dernières
--   minutes prolonge la vente de 2 minutes (pas de « coup de dernière
--   seconde »). TVA prélevée à la vente comme en vitrine.
--   Clôture : auctions_settle_due(), appelée par les pages (pas de tâche
--   planifiée nécessaire) ; personne ne peut enchérir après l'heure de fin.
--
-- SONDAGES
--   Créés, clos et supprimés par les admins (permission manage_users) ;
--   tous les membres votent (choix unique ou multiple, vote modifiable tant
--   que le sondage est ouvert). Résultats visibles tout le temps, après
--   avoir voté, ou seulement à la clôture ; votes anonymes ou nominatifs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nouveaux types de notification : auction, poll
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_types text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null or (v_def like '%auction%' and v_def like '%poll%') then return; end if;
  if v_def ~ '\{' then
    v_types := string_to_array(substring(v_def from '\{([^}]*)\}'), ',');
  else
    select array_agg(m[1]) into v_types from regexp_matches(v_def, '''([a-z_]+)''', 'g') as m;
  end if;
  if v_types is null or cardinality(v_types) < 5 then
    raise exception 'Liste des types de notification illisible (%), migration arrêtée par prudence.', v_def;
  end if;
  if not 'auction' = any (v_types) then v_types := array_append(v_types, 'auction'); end if;
  if not 'poll' = any (v_types) then v_types := array_append(v_types, 'poll'); end if;
  alter table public.notifications drop constraint notifications_type_check;
  execute format('alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_types);
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Tables des enchères
-- ---------------------------------------------------------------------
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shop_items(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete cascade,
  quantity int not null default 1 check (quantity between 1 and 1000),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  start_price numeric(15,2) not null check (start_price >= 1),
  buy_now_price numeric(15,2) check (buy_now_price is null or buy_now_price > start_price),
  current_price numeric(15,2),
  top_bidder uuid references public.profiles(id) on delete set null,
  bid_count int not null default 0,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'sold', 'unsold', 'cancelled')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auctions_open_idx on public.auctions (ends_at) where status = 'open';
create index if not exists auctions_seller_idx on public.auctions (seller_id, created_at desc);
create index if not exists auctions_top_bidder_idx on public.auctions (top_bidder) where status = 'open';
create index if not exists auctions_item_idx on public.auctions (item_id);
-- Une ligne d'achat ne peut être en jeu que dans une seule vente à la fois.
create unique index if not exists auctions_purchase_open_idx on public.auctions (purchase_id) where status = 'open';

create table if not exists public.auction_bids (
  id bigserial primary key,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  bidder_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(15,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists auction_bids_auction_idx on public.auction_bids (auction_id, created_at desc);
create index if not exists auction_bids_bidder_idx on public.auction_bids (bidder_id);

alter table public.auctions enable row level security;
alter table public.auction_bids enable row level security;

-- Lecture pour les membres connectés ; toute écriture passe par les
-- fonctions ci-dessous (aucune politique d'écriture).
drop policy if exists "auctions_select" on public.auctions;
create policy "auctions_select" on public.auctions for select to authenticated using (true);
drop policy if exists "auction_bids_select" on public.auction_bids;
create policy "auction_bids_select" on public.auction_bids for select to authenticated using (true);

revoke all on public.auctions, public.auction_bids from anon;
revoke insert, update, delete on public.auctions, public.auction_bids from authenticated;
grant select on public.auctions, public.auction_bids to authenticated;

-- Mises à jour en direct (pages ouvertes) quand Realtime est en place.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.auctions;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Petites aides
-- ---------------------------------------------------------------------
-- Offre minimale suivante : le prix de départ, puis +5 % (au moins 1 z).
create or replace function public.auction_min_next(p_start numeric, p_current numeric)
returns numeric
language sql immutable
as $$
  select case when p_current is null then p_start
              else p_current + greatest(1, ceil(p_current * 0.05)) end;
$$;

create or replace function public._auction_notify(p_user uuid, p_title text, p_body text, p_auction uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, 'auction', p_title, p_body, '/dashboard/shop?enchere=' || p_auction
  where p_user is not null and exists (select 1 from public.profiles where id = p_user);
$$;

-- Rend l'argent bloqué de la meilleure offre (dépassement, annulation…).
create or replace function public._auction_refund(p_user uuid, p_amount numeric, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user is null or p_amount is null or p_amount <= 0 then return; end if;
  update public.wallets set balance = balance + p_amount where user_id = p_user;
  if found then
    insert into public.transactions (user_id, amount, reason, created_by)
    values (p_user, p_amount, p_reason, p_user);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Mettre un lot en vente
-- ---------------------------------------------------------------------
create or replace function public.auction_create(
  p_source text,          -- 'stock' (objet que je vends) ou 'resale' (ligne de mes achats)
  p_ref uuid,             -- id de l'objet (stock) ou de l'achat (revente)
  p_quantity int,
  p_start_price numeric,
  p_buy_now numeric,
  p_hours int,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_staff boolean;
  v_item public.shop_items;
  v_purchase public.purchases;
  v_qty int;
  v_start numeric := round(coalesce(p_start_price, 0), 2);
  v_buy numeric := case when p_buy_now is null or p_buy_now <= 0 then null else round(p_buy_now, 2) end;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_open int;
  v_max_open int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Ton compte est gelé : impossible de vendre tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('shop') then
    raise exception 'La boutique est temporairement fermée par l''administration.';
  end if;
  if p_hours is null or p_hours not in (1, 3, 6, 12, 24, 48, 72, 168) then
    raise exception 'Durée de vente invalide.';
  end if;
  if v_start < 1 or v_start > 1000000000000 then
    raise exception 'Le prix de départ doit être compris entre 1 z et 1 000 milliards de z.';
  end if;
  if v_buy is not null and (v_buy <= v_start or v_buy > 1000000000000) then
    raise exception 'L''achat immédiat doit être plus cher que le prix de départ.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Le mot du vendeur est limité à 500 caractères.';
  end if;

  v_staff := public.has_permission(v_uid, 'manage_shop');
  select count(*) into v_open from public.auctions where seller_id = v_uid and status = 'open';
  v_max_open := case when v_staff then 30 else 5 end;
  if v_open >= v_max_open then
    raise exception 'Tu as déjà % ventes aux enchères en cours : attends qu''une se termine.', v_open;
  end if;

  if p_source = 'resale' then
    select * into v_purchase from public.purchases where id = p_ref and user_id = v_uid for update;
    if v_purchase.id is null then raise exception 'Cet achat n''est pas à toi.'; end if;
    if v_purchase.status = 'cancelled' then raise exception 'Cet achat a été annulé.'; end if;
    select * into v_item from public.shop_items where id = v_purchase.item_id;
    if v_item.effect is not null then
      raise exception 'Les objets à effet sont consommés à l''achat : ils ne se revendent pas.';
    end if;
    if exists (select 1 from public.auctions where purchase_id = v_purchase.id and status = 'open') then
      raise exception 'Cet achat est déjà aux enchères.';
    end if;
    v_qty := v_purchase.quantity;
  elsif p_source = 'stock' then
    select * into v_item from public.shop_items where id = p_ref for update;
    if v_item.id is null or v_item.hidden_at is not null then raise exception 'Objet introuvable.'; end if;
    if v_item.created_by is distinct from v_uid and not v_staff then
      raise exception 'Seul le vendeur de cet objet peut le mettre aux enchères.';
    end if;
    v_qty := coalesce(p_quantity, 1);
    if v_qty < 1 or v_qty > 100 then raise exception 'Quantité invalide (1 à 100).'; end if;
    if v_item.stock is not null then
      if v_item.stock < v_qty then raise exception 'Stock insuffisant (% disponible%).', v_item.stock, case when v_item.stock > 1 then 's' else '' end; end if;
      update public.shop_items set stock = stock - v_qty where id = v_item.id;
    end if;
  else
    raise exception 'Type de vente inconnu.';
  end if;

  insert into public.auctions (item_id, purchase_id, quantity, seller_id, business_id, note,
                               start_price, buy_now_price, ends_at)
  values (v_item.id, v_purchase.id, v_qty, v_uid,
          case when p_source = 'stock' then v_item.business_id end, v_note,
          v_start, v_buy, now() + make_interval(hours => p_hours))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Clôture d'une vente (interne)
-- ---------------------------------------------------------------------
create or replace function public._auction_settle(p_id uuid, p_force boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.auctions;
  v_name text;
  v_effect text;
  v_rate numeric;
  v_vat numeric(18,2);
  v_net numeric(18,2);
  v_pid uuid;
begin
  select * into a from public.auctions where id = p_id for update;
  if a.id is null or a.status <> 'open' then return; end if;
  if a.ends_at > now() and not p_force then return; end if;
  select name, effect into v_name, v_effect from public.shop_items where id = a.item_id;
  v_name := coalesce(v_name, 'objet') || case when a.quantity > 1 then ' × ' || a.quantity else '' end;

  -- Personne n'a enchéri (ou l'enchérisseur a quitté le S.I.D.).
  if a.top_bidder is null or a.current_price is null then
    if a.purchase_id is null then
      update public.shop_items set stock = stock + a.quantity where id = a.item_id and stock is not null;
    end if;
    update public.auctions set status = 'unsold', settled_at = now() where id = a.id;
    perform public._auction_notify(a.seller_id, 'Enchère terminée sans offre', v_name, a.id);
    return;
  end if;

  -- Revente : l'achat a pu être annulé par l'équipe entre-temps.
  if a.purchase_id is not null and not exists (
    select 1 from public.purchases where id = a.purchase_id and user_id = a.seller_id and status <> 'cancelled'
  ) then
    perform public._auction_refund(a.top_bidder, a.current_price, 'Enchère annulée : ' || v_name || ' (remboursement)');
    update public.auctions set status = 'cancelled', settled_at = now() where id = a.id;
    perform public._auction_notify(a.top_bidder, 'Enchère annulée', v_name || ' : l''objet n''est plus disponible, ton offre t''est rendue.', a.id);
    return;
  end if;

  v_rate := public.get_config_numeric('vat_rate', 0.05);
  v_vat := round(a.current_price * v_rate, 2);
  v_net := a.current_price - v_vat;

  -- L'objet passe au gagnant.
  if a.purchase_id is not null then
    update public.purchases set user_id = a.top_bidder, total_price = a.current_price, created_at = now()
    where id = a.purchase_id
    returning id into v_pid;
  else
    insert into public.purchases (item_id, user_id, quantity, total_price, status)
    values (a.item_id, a.top_bidder, a.quantity, a.current_price, 'pending')
    returning id into v_pid;
  end if;

  -- Le vendeur (ou son entreprise) est payé, TVA déduite.
  if a.business_id is not null and exists (select 1 from public.businesses where id = a.business_id) then
    update public.businesses set treasury_balance = treasury_balance + v_net where id = a.business_id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (a.business_id, v_net, 'Vente aux enchères : ' || v_name || ' (TVA déduite)', a.top_bidder);
  else
    update public.wallets set balance = balance + v_net where user_id = a.seller_id;
    if found then
      insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
      values (a.seller_id, v_net, 'Vente aux enchères : ' || v_name || ' (TVA ' || (v_rate * 100)::text || '% déduite)', v_pid, a.top_bidder);
    end if;
  end if;
  update public.tax_pool set balance = balance + v_vat where id = true;

  update public.auctions set status = 'sold', settled_at = now(), ends_at = least(ends_at, now()) where id = a.id;

  perform public._auction_notify(a.top_bidder, 'Enchère remportée',
    v_name || ' pour ' || (public._fmt_z(a.current_price) || ' z') || '.', a.id);
  perform public._auction_notify(a.seller_id, 'Vendu aux enchères',
    v_name || ' pour ' || (public._fmt_z(a.current_price) || ' z') || '.', a.id);
end;
$$;

-- Clôt toutes les ventes arrivées à échéance. Appelée par les pages : sans
-- effet (et rapide) quand il n'y a rien à clore.
create or replace function public.auctions_settle_due()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from public.auctions
    where status = 'open' and ends_at <= now()
    order by ends_at
    limit 50
    for update skip locked
  loop
    perform public._auction_settle(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Enchérir
-- ---------------------------------------------------------------------
create or replace function public.auction_bid(p_auction uuid, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a public.auctions;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_min numeric;
  v_due numeric;
  v_balance numeric;
  v_name text;
  v_prev uuid;
  v_prev_amount numeric;
  v_buy_now boolean := false;
  v_ends timestamptz;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if coalesce((select is_frozen from public.profiles where id = v_uid), false) then
    raise exception 'Ton compte est gelé : impossible d''enchérir tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('shop') then
    raise exception 'La boutique est temporairement fermée par l''administration.';
  end if;

  select * into a from public.auctions where id = p_auction for update;
  if a.id is null then raise exception 'Vente introuvable.'; end if;
  if a.status <> 'open' or a.ends_at <= now() then raise exception 'Cette vente est terminée.'; end if;
  if a.seller_id = v_uid then raise exception 'Tu ne peux pas enchérir sur ta propre vente.'; end if;
  if a.business_id is not null and exists (
    select 1 from public.businesses where id = a.business_id and founder_id = v_uid
  ) then
    raise exception 'Tu ne peux pas enchérir sur une vente de ta propre entreprise.';
  end if;

  if a.buy_now_price is not null and v_amount >= a.buy_now_price then
    v_amount := a.buy_now_price;
    v_buy_now := true;
  end if;
  v_min := public.auction_min_next(a.start_price, a.current_price);
  if not v_buy_now and v_amount < v_min then
    raise exception 'L''offre minimale est de %.', (public._fmt_z(v_min) || ' z');
  end if;
  if v_amount > 1000000000000 then raise exception 'Montant trop élevé.'; end if;
  if a.top_bidder = v_uid and not v_buy_now then
    raise exception 'Tu as déjà la meilleure offre.';
  end if;

  -- Ce qui est bloqué sur ma bourse : tout, ou la différence si je menais déjà.
  v_due := v_amount - case when a.top_bidder = v_uid then coalesce(a.current_price, 0) else 0 end;
  select balance into v_balance from public.wallets where user_id = v_uid for update;
  if v_balance is null then raise exception 'Bourse introuvable.'; end if;
  if v_balance < 0 then raise exception 'Ton solde est négatif : règle ta dette avant d''enchérir.'; end if;
  if v_balance < v_due then raise exception 'Solde insuffisant : il te faut % disponibles.', (public._fmt_z(v_due) || ' z'); end if;

  select name into v_name from public.shop_items where id = a.item_id;
  v_name := coalesce(v_name, 'objet') || case when a.quantity > 1 then ' × ' || a.quantity else '' end;

  update public.wallets set balance = balance - v_due where user_id = v_uid;
  insert into public.transactions (user_id, amount, reason, created_by)
  values (v_uid, -v_due, 'Enchère : ' || v_name || ' (montant bloqué)', v_uid);

  v_prev := a.top_bidder;
  v_prev_amount := a.current_price;
  if v_prev is not null and v_prev <> v_uid then
    perform public._auction_refund(v_prev, v_prev_amount, 'Enchère dépassée : ' || v_name || ' (remboursement)');
    perform public._auction_notify(v_prev, 'Enchère dépassée',
      v_name || ' : nouvelle offre à ' || (public._fmt_z(v_amount) || ' z') || '. Ton argent t''est rendu.', a.id);
  end if;

  -- Offre dans les 2 dernières minutes : la vente est prolongée.
  v_ends := case when a.ends_at - now() < interval '2 minutes' then now() + interval '2 minutes' else a.ends_at end;

  update public.auctions
  set current_price = v_amount, top_bidder = v_uid, bid_count = bid_count + 1, ends_at = v_ends
  where id = a.id;
  insert into public.auction_bids (auction_id, bidder_id, amount) values (a.id, v_uid, v_amount);

  if a.bid_count = 0 then
    perform public._auction_notify(a.seller_id, 'Première offre', v_name || ' : ' || (public._fmt_z(v_amount) || ' z') || '.', a.id);
  end if;

  if v_buy_now then
    perform public._auction_settle(a.id, true);
  end if;

  return jsonb_build_object('amount', v_amount, 'ends_at', v_ends, 'bought', v_buy_now);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Annuler une vente
-- ---------------------------------------------------------------------
create or replace function public.auction_cancel(p_auction uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a public.auctions;
  v_staff boolean;
  v_name text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select * into a from public.auctions where id = p_auction for update;
  if a.id is null then raise exception 'Vente introuvable.'; end if;
  if a.status <> 'open' then raise exception 'Cette vente est déjà terminée.'; end if;
  v_staff := public.has_permission(v_uid, 'manage_shop') or public.has_permission(v_uid, 'manage_users');
  if a.seller_id <> v_uid and not v_staff then raise exception 'Permission refusée.'; end if;
  if a.seller_id = v_uid and not v_staff and a.bid_count > 0 then
    raise exception 'Il y a déjà des offres : seule l''administration peut annuler cette vente.';
  end if;

  select name into v_name from public.shop_items where id = a.item_id;
  v_name := coalesce(v_name, 'objet') || case when a.quantity > 1 then ' × ' || a.quantity else '' end;

  if a.top_bidder is not null then
    perform public._auction_refund(a.top_bidder, a.current_price, 'Enchère annulée : ' || v_name || ' (remboursement)');
    perform public._auction_notify(a.top_bidder, 'Enchère annulée', v_name || ' : la vente a été annulée, ton offre t''est rendue.', a.id);
  end if;
  if a.purchase_id is null then
    update public.shop_items set stock = stock + a.quantity where id = a.item_id and stock is not null;
  end if;
  update public.auctions set status = 'cancelled', settled_at = now() where id = a.id;
  if a.seller_id <> v_uid then
    perform public._auction_notify(a.seller_id, 'Vente annulée par l''administration', v_name, a.id);
  end if;
end;
$$;

-- Une vente supprimée en cascade (compte supprimé…) rend l'argent bloqué.
create or replace function public._auction_before_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'open' then
    perform public._auction_refund(old.top_bidder, old.current_price, 'Enchère annulée (remboursement)');
    if old.purchase_id is null then
      update public.shop_items set stock = stock + old.quantity where id = old.item_id and stock is not null;
    end if;
  end if;
  return old;
end;
$$;
drop trigger if exists trg_auction_before_delete on public.auctions;
create trigger trg_auction_before_delete before delete on public.auctions
  for each row execute function public._auction_before_delete();

-- ---------------------------------------------------------------------
-- 7. Lecture : liste des ventes, historique des offres
-- ---------------------------------------------------------------------
create or replace function public.auctions_list(p_scope text default 'open', p_id uuid default null)
returns table (
  id uuid,
  item_id uuid,
  item_name text,
  item_image text,
  item_description text,
  source text,
  quantity int,
  note text,
  seller_id uuid,
  seller_name text,
  business_name text,
  start_price numeric,
  buy_now_price numeric,
  current_price numeric,
  min_next numeric,
  top_bidder_id uuid,
  top_bidder_name text,
  bid_count int,
  my_best numeric,
  ends_at timestamptz,
  status text,
  settled_at timestamptz,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
begin
  if v_uid is null then return; end if;
  v_admin := public.has_permission(v_uid, 'manage_users');
  return query
  select a.id, a.item_id, si.name, si.image_url, si.description,
         case when a.purchase_id is null then 'stock' else 'resale' end,
         a.quantity, a.note,
         a.seller_id,
         case when sp.is_invisible and not v_admin and a.seller_id <> v_uid then 'Agent masqué' else sp.nickname end,
         b.name,
         a.start_price, a.buy_now_price, a.current_price,
         public.auction_min_next(a.start_price, a.current_price),
         a.top_bidder,
         case when tp.is_invisible and not v_admin and a.top_bidder <> v_uid then 'Agent masqué' else tp.nickname end,
         a.bid_count,
         (select max(ab.amount) from public.auction_bids ab where ab.auction_id = a.id and ab.bidder_id = v_uid),
         a.ends_at, a.status, a.settled_at, a.created_at
  from public.auctions a
  join public.shop_items si on si.id = a.item_id
  left join public.profiles sp on sp.id = a.seller_id
  left join public.profiles tp on tp.id = a.top_bidder
  left join public.businesses b on b.id = a.business_id
  where case when p_id is not null then a.id = p_id else (case p_scope
          when 'open' then a.status = 'open'
          when 'mine' then a.seller_id = v_uid
                        or exists (select 1 from public.auction_bids ab where ab.auction_id = a.id and ab.bidder_id = v_uid)
          when 'ended' then a.status <> 'open' and a.created_at > now() - interval '60 days'
          else false
        end) end
  order by case when a.status = 'open' then 0 else 1 end,
           case when a.status = 'open' then a.ends_at end asc,
           coalesce(a.settled_at, a.created_at) desc
  limit 120;
end;
$$;

create or replace function public.auction_bids_list(p_auction uuid)
returns table (bidder_name text, is_me boolean, amount numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
begin
  if v_uid is null then return; end if;
  v_admin := public.has_permission(v_uid, 'manage_users');
  return query
  select case when p.is_invisible and not v_admin and ab.bidder_id <> v_uid then 'Agent masqué' else coalesce(p.nickname, 'Agent') end,
         ab.bidder_id = v_uid, ab.amount, ab.created_at
  from public.auction_bids ab
  left join public.profiles p on p.id = ab.bidder_id
  where ab.auction_id = p_auction
  order by ab.created_at desc
  limit 50;
end;
$$;

-- Lignes de « Mes achats » qui peuvent être revendues.
create or replace function public.auction_resale_candidates()
returns table (purchase_id uuid, item_id uuid, item_name text, item_image text, quantity int, total_price numeric, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, si.id, si.name, si.image_url, p.quantity, p.total_price, p.created_at
  from public.purchases p
  join public.shop_items si on si.id = p.item_id
  where p.user_id = auth.uid()
    and p.status <> 'cancelled'
    and si.effect is null
    and not exists (select 1 from public.auctions a where a.purchase_id = p.id and a.status = 'open')
  order by p.created_at desc
  limit 100;
$$;

-- ---------------------------------------------------------------------
-- 8. Sondages
-- ---------------------------------------------------------------------
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 200),
  details text check (details is null or char_length(details) <= 1000),
  multiple boolean not null default false,
  anonymous boolean not null default true,
  show_results text not null default 'after_vote' check (show_results in ('always', 'after_vote', 'after_close')),
  closes_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position int not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);
create index if not exists poll_votes_poll_user_idx on public.poll_votes (poll_id, user_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "polls_select" on public.polls;
create policy "polls_select" on public.polls for select to authenticated using (true);
drop policy if exists "poll_options_select" on public.poll_options;
create policy "poll_options_select" on public.poll_options for select to authenticated using (true);
-- Chacun ne voit que ses propres votes ; les totaux passent par polls_list().
drop policy if exists "poll_votes_select_own" on public.poll_votes;
create policy "poll_votes_select_own" on public.poll_votes for select to authenticated using (user_id = auth.uid());

revoke all on public.polls, public.poll_options, public.poll_votes from anon;
revoke insert, update, delete on public.polls, public.poll_options, public.poll_votes from authenticated;
grant select on public.polls, public.poll_options, public.poll_votes to authenticated;

create or replace function public.poll_create(
  p_question text,
  p_details text,
  p_options text[],
  p_multiple boolean default false,
  p_anonymous boolean default true,
  p_show_results text default 'after_vote',
  p_closes_at timestamptz default null,
  p_notify boolean default true
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := trim(coalesce(p_question, ''));
  v_d text := nullif(trim(coalesce(p_details, '')), '');
  v_opts text[];
  v_id uuid;
  i int;
begin
  if not public.has_permission(v_uid, 'manage_users') then raise exception 'Permission refusée.'; end if;
  if char_length(v_q) < 3 or char_length(v_q) > 200 then raise exception 'La question doit faire entre 3 et 200 caractères.'; end if;
  if v_d is not null and char_length(v_d) > 1000 then raise exception 'Le texte d''accompagnement est limité à 1 000 caractères.'; end if;
  if p_show_results not in ('always', 'after_vote', 'after_close') then raise exception 'Réglage des résultats invalide.'; end if;
  if p_closes_at is not null and p_closes_at <= now() + interval '5 minutes' then
    raise exception 'La date de clôture doit être dans le futur.';
  end if;

  select array_agg(o order by n) into v_opts
  from (
    select distinct on (lower(trim(x))) trim(x) as o, n
    from unnest(coalesce(p_options, '{}')) with ordinality as t(x, n)
    where trim(x) <> ''
    order by lower(trim(x)), n
  ) s;
  if v_opts is null or cardinality(v_opts) < 2 then raise exception 'Il faut au moins deux réponses différentes.'; end if;
  if cardinality(v_opts) > 12 then raise exception '12 réponses au maximum.'; end if;
  if exists (select 1 from unnest(v_opts) o where char_length(o) > 120) then raise exception 'Une réponse est limitée à 120 caractères.'; end if;

  insert into public.polls (question, details, multiple, anonymous, show_results, closes_at, created_by)
  values (v_q, v_d, coalesce(p_multiple, false), coalesce(p_anonymous, true), p_show_results, p_closes_at, v_uid)
  returning id into v_id;

  for i in 1 .. cardinality(v_opts) loop
    insert into public.poll_options (poll_id, label, position) values (v_id, v_opts[i], i);
  end loop;

  if coalesce(p_notify, true) then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'poll', 'Nouveau sondage', left(v_q, 160), '/dashboard/polls?sondage=' || v_id
    from public.profiles p
    where p.status = 'active' and p.id <> v_uid;
  end if;
  return v_id;
end;
$$;

create or replace function public.poll_vote(p_poll uuid, p_options uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.polls;
  v_opts uuid[] := coalesce((select array_agg(distinct x) from unnest(p_options) x where x is not null), '{}');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'Seuls les membres actifs votent.';
  end if;
  select * into v_poll from public.polls where id = p_poll;
  if v_poll.id is null then raise exception 'Sondage introuvable.'; end if;
  if v_poll.closed_at is not null or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'Ce sondage est clos.';
  end if;
  if not v_poll.multiple and cardinality(v_opts) > 1 then raise exception 'Une seule réponse possible.'; end if;
  if exists (select 1 from unnest(v_opts) x where not exists (select 1 from public.poll_options o where o.id = x and o.poll_id = p_poll)) then
    raise exception 'Réponse inconnue.';
  end if;

  delete from public.poll_votes where poll_id = p_poll and user_id = v_uid;
  insert into public.poll_votes (poll_id, option_id, user_id)
  select p_poll, x, v_uid from unnest(v_opts) x;
end;
$$;

create or replace function public.poll_close(p_poll uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then raise exception 'Permission refusée.'; end if;
  update public.polls set closed_at = now() where id = p_poll and closed_at is null;
end;
$$;

create or replace function public.poll_delete(p_poll uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then raise exception 'Permission refusée.'; end if;
  delete from public.notifications where type = 'poll' and link = '/dashboard/polls?sondage=' || p_poll;
  delete from public.polls where id = p_poll;
end;
$$;

create or replace function public.polls_list(p_limit int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_out jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  v_admin := public.has_permission(v_uid, 'manage_users');

  with p as (
    select po.*,
           (po.closed_at is null and (po.closes_at is null or po.closes_at > now())) as is_open,
           exists (select 1 from public.poll_votes v where v.poll_id = po.id and v.user_id = v_uid) as voted
    from public.polls po
    order by po.created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  ), q as (
    select p.*, (v_admin or p.show_results = 'always' or (p.show_results = 'after_vote' and p.voted) or not p.is_open) as vis
    from p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id,
           'question', q.question,
           'details', q.details,
           'multiple', q.multiple,
           'anonymous', q.anonymous,
           'show_results', q.show_results,
           'closes_at', q.closes_at,
           'closed_at', q.closed_at,
           'is_open', q.is_open,
           'created_at', q.created_at,
           'author', (select nickname from public.profiles where id = q.created_by),
           'voted', q.voted,
           'results_visible', q.vis,
           'voters', (select count(distinct v.user_id) from public.poll_votes v where v.poll_id = q.id),
           'my_votes', coalesce((select jsonb_agg(v.option_id) from public.poll_votes v where v.poll_id = q.id and v.user_id = v_uid), '[]'::jsonb),
           'options', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', o.id,
                      'label', o.label,
                      'votes', case when q.vis then (select count(*) from public.poll_votes v where v.option_id = o.id) end,
                      'names', case when q.vis and not q.anonymous then (
                                 select coalesce(jsonb_agg(pr.nickname order by pr.nickname), '[]'::jsonb)
                                 from public.poll_votes v join public.profiles pr on pr.id = v.user_id
                                 where v.option_id = o.id
                               ) end
                    ) order by o.position), '[]'::jsonb)
             from public.poll_options o where o.poll_id = q.id
           )
         ) order by q.is_open desc, q.created_at desc), '[]'::jsonb)
  into v_out
  from q;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.auction_min_next(numeric, numeric)',
    'public._auction_notify(uuid, text, text, uuid)',
    'public._auction_refund(uuid, numeric, text)',
    'public.auction_create(text, uuid, int, numeric, numeric, int, text)',
    'public._auction_settle(uuid, boolean)',
    'public.auctions_settle_due()',
    'public.auction_bid(uuid, numeric)',
    'public.auction_cancel(uuid)',
    'public._auction_before_delete()',
    'public.auctions_list(text, uuid)',
    'public.auction_bids_list(uuid)',
    'public.auction_resale_candidates()',
    'public.poll_create(text, text, text[], boolean, boolean, text, timestamptz, boolean)',
    'public.poll_vote(uuid, uuid[])',
    'public.poll_close(uuid)',
    'public.poll_delete(uuid)',
    'public.polls_list(int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
  end loop;

  -- Fonctions internes : pas d'appel direct depuis le site.
  revoke all on function public._auction_notify(uuid, text, text, uuid) from authenticated;
  revoke all on function public._auction_refund(uuid, numeric, text) from authenticated;
  revoke all on function public._auction_settle(uuid, boolean) from authenticated;
  revoke all on function public._auction_before_delete() from authenticated;

  foreach f in array array[
    'public.auction_min_next(numeric, numeric)',
    'public.auction_create(text, uuid, int, numeric, numeric, int, text)',
    'public.auctions_settle_due()',
    'public.auction_bid(uuid, numeric)',
    'public.auction_cancel(uuid)',
    'public.auctions_list(text, uuid)',
    'public.auction_bids_list(uuid)',
    'public.auction_resale_candidates()',
    'public.poll_create(text, text, text[], boolean, boolean, text, timestamptz, boolean)',
    'public.poll_vote(uuid, uuid[])',
    'public.poll_close(uuid)',
    'public.poll_delete(uuid)',
    'public.polls_list(int)'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
