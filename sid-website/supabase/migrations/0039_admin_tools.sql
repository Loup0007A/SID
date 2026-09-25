-- =========================================================
-- Outils d'administration supplémentaires :
--
-- 1) ANNONCES affichées à la connexion (informations importantes) : une
--    bannière/modale visible tant que le membre ne l'a pas fermée.
-- 2) MAINTENANCE : suspendre certaines parties du site (boutique, chat,
--    banque/bourse, quêtes, inscriptions), chacune avec un message
--    explicatif affiché à la place.
-- 3) SANCTIONS : au-delà du bannir/mute déjà existants (0018), un système
--    de sanctions complet — avertissement, mute, gel de compte (bloque
--    achats/bourse/emprunt/quêtes), bannissement, amende — chacune
--    pouvant être temporaire (durée en minutes) et journalisée. Les
--    sanctions temporaires expirent automatiquement (intégré au
--    traitement quotidien déjà déclenché à la connexion, aucun job
--    planifié requis).
-- =========================================================

-- ---------------------------------------------------------
-- 1) ANNONCES
-- ---------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements_select" on public.announcements;
create policy "announcements_select" on public.announcements for select using (true);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

drop policy if exists "announcement_reads_select" on public.announcement_reads;
create policy "announcement_reads_select" on public.announcement_reads for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

-- Aucune policy insert/update directe : tout passe par les fonctions.

create or replace function public.create_announcement(p_title text, p_body text, p_severity text default 'info')
returns public.announcements
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.announcements;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Le titre est obligatoire.';
  end if;
  if p_severity not in ('info', 'warning', 'critical') then
    raise exception 'Niveau d''annonce invalide.';
  end if;

  insert into public.announcements (title, body, severity, created_by)
  values (p_title, p_body, p_severity, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.deactivate_announcement(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;
  update public.announcements set is_active = false where id = p_id;
end;
$$;

-- Annonces actives que CE membre n'a pas encore vues (affichées à la connexion).
create or replace function public.list_unread_announcements()
returns setof public.announcements
language sql
stable
security definer set search_path = public
as $$
  select a.* from public.announcements a
  where a.is_active
    and not exists (
      select 1 from public.announcement_reads r
      where r.announcement_id = a.id and r.user_id = auth.uid()
    )
  order by a.created_at asc;
$$;

create or replace function public.acknowledge_announcement(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.announcement_reads (announcement_id, user_id)
  values (p_id, auth.uid())
  on conflict (announcement_id, user_id) do nothing;
end;
$$;

create or replace function public.list_all_announcements()
returns setof public.announcements
language sql
stable
security definer set search_path = public
as $$
  select * from public.announcements
  where public.has_permission(auth.uid(), 'manage_users')
  order by created_at desc;
$$;

-- ---------------------------------------------------------
-- 2) MAINTENANCE — la table et is_feature_enabled() existent déjà (voir la
-- migration précédente) ; on ajoute ici les clés restantes et l'écriture.
-- ---------------------------------------------------------
insert into public.maintenance_flags (key, message) values
  ('shop', 'La boutique est temporairement fermée.'),
  ('chat', 'La messagerie est temporairement indisponible.'),
  ('quests', 'Le panneau des quêtes est temporairement fermé.'),
  ('registrations', 'Les nouvelles candidatures sont temporairement suspendues.')
on conflict (key) do nothing;

create or replace function public.set_maintenance(p_key text, p_enabled boolean, p_message text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;

  update public.maintenance_flags
    set is_enabled = p_enabled,
        message = coalesce(p_message, message),
        updated_by = auth.uid(),
        updated_at = now()
    where key = p_key;

  if not found then
    insert into public.maintenance_flags (key, is_enabled, message, updated_by)
    values (p_key, p_enabled, p_message, auth.uid());
  end if;
end;
$$;

create or replace function public.list_maintenance_flags()
returns setof public.maintenance_flags
language sql
stable
security definer set search_path = public
as $$
  select * from public.maintenance_flags order by key;
$$;

-- Bloque les nouvelles inscriptions quand 'registrations' est désactivée.
create or replace function public.block_registration_if_suspended()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_feature_enabled('registrations') then
    raise exception 'Les inscriptions sont temporairement suspendues. Réessaie plus tard.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_registration on auth.users;
create trigger trg_block_registration
  before insert on auth.users
  for each row execute function public.block_registration_if_suspended();

-- Chat : bloqué si la messagerie est en maintenance (en plus du mute déjà en place).
drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_channel_participant(channel_id, auth.uid())
    and not coalesce((select is_muted from public.profiles where id = auth.uid()), false)
    and not coalesce((select is_frozen from public.profiles where id = auth.uid()), false)
    and public.is_feature_enabled('chat')
  );

-- Quêtes : bloqué si le panneau est en maintenance, ou si le compte est gelé.
drop policy if exists "quest_participants_join" on public.quest_participants;
create policy "quest_participants_join" on public.quest_participants for insert
  with check (
    (
      user_id = auth.uid()
      and not coalesce((select is_frozen from public.profiles where id = auth.uid()), false)
      and public.is_feature_enabled('quests')
    )
    or public.has_permission(auth.uid(), 'manage_quests')
  );

-- Boutique : version finale de purchase_item (reprend la logique TVA +
-- entreprise de 0036), avec vérification de maintenance et de compte gelé.
create or replace function public.purchase_item(p_item_id uuid, p_quantity int default 1)
returns public.purchases
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.shop_items;
  v_balance numeric(18,2);
  v_unit_price numeric(15,2);
  v_total numeric(15,2);
  v_vat_rate numeric;
  v_vat numeric(18,2);
  v_seller_amount numeric(18,2);
  v_purchase public.purchases;
begin
  if p_quantity < 1 then
    raise exception 'La quantité doit être au moins 1';
  end if;
  if coalesce((select is_frozen from public.profiles where id = auth.uid()), false) then
    raise exception 'Ton compte est gelé : impossible d''acheter tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('shop') then
    raise exception 'La boutique est temporairement fermée par l''administration.';
  end if;

  select balance into v_balance from public.wallets where user_id = auth.uid() for update;
  if v_balance is not null and v_balance < 0 then
    raise exception 'Ton solde est négatif (dette avec intérêts impayés) : règle-le avant de pouvoir acheter quoi que ce soit.';
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
  v_total := v_unit_price * p_quantity;

  if v_balance is null or v_balance < v_total then
    raise exception 'Solde insuffisant';
  end if;

  v_vat_rate := public.get_config_numeric('vat_rate', 0.05);
  v_vat := round(v_total * v_vat_rate, 2);
  v_seller_amount := v_total - v_vat;

  update public.wallets set balance = balance - v_total where user_id = auth.uid();

  insert into public.purchases (item_id, user_id, quantity, total_price, status)
  values (p_item_id, auth.uid(), p_quantity, v_total, 'pending')
  returning * into v_purchase;

  insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
  values (auth.uid(), -v_total, 'Achat : ' || v_item.name, v_purchase.id, auth.uid());

  if v_item.business_id is not null then
    update public.businesses set treasury_balance = treasury_balance + v_seller_amount where id = v_item.business_id;
    insert into public.business_transactions (business_id, amount, reason, created_by)
    values (v_item.business_id, v_seller_amount, 'Vente : ' || v_item.name || ' (TVA déduite)', auth.uid());
  elsif v_item.created_by is not null and v_item.created_by <> auth.uid() then
    update public.wallets set balance = balance + v_seller_amount where user_id = v_item.created_by;
    insert into public.transactions (user_id, amount, reason, related_purchase_id, created_by)
    values (v_item.created_by, v_seller_amount, 'Vente : ' || v_item.name || ' (TVA ' || (v_vat_rate * 100)::text || '% déduite)', v_purchase.id, auth.uid());
  end if;

  update public.tax_pool set balance = balance + v_vat where id = true;

  if v_item.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = p_item_id;
  end if;

  return v_purchase;
end;
$$;

-- Emprunt bancaire bloqué en cas de maintenance ou de compte gelé (achat et
-- vente d'actions le sont déjà, voir la migration précédente).
create or replace function public.borrow_money(p_amount numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_debt numeric(18,2);
  v_max_debt numeric;
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;
  if coalesce((select is_frozen from public.profiles where id = auth.uid()), false) then
    raise exception 'Ton compte est gelé : impossible d''emprunter tant que la sanction est active.';
  end if;
  if not public.is_feature_enabled('bank') then
    raise exception 'La banque est temporairement fermée par l''administration.';
  end if;

  select debt_principal into v_current_debt from public.wallets where user_id = auth.uid() for update;
  v_max_debt := public.get_config_numeric('max_debt_principal', 50000);

  if coalesce(v_current_debt, 0) + p_amount > v_max_debt then
    raise exception 'Plafond d''emprunt atteint (maximum % Cr. de dette cumulée).', v_max_debt;
  end if;

  update public.wallets
    set balance = balance + p_amount,
        debt_principal = debt_principal + p_amount,
        last_debt_interest_at = coalesce(last_debt_interest_at, now())
    where user_id = auth.uid();

  insert into public.transactions (user_id, amount, reason, created_by)
  values (auth.uid(), p_amount, 'Emprunt bancaire', auth.uid());
end;
$$;

-- ---------------------------------------------------------
-- 3) SANCTIONS
-- ---------------------------------------------------------
alter table public.profiles add column if not exists mute_until timestamptz;
alter table public.profiles add column if not exists is_frozen boolean not null default false;
alter table public.profiles add column if not exists freeze_until timestamptz;
alter table public.profiles add column if not exists ban_until timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'chat_message', 'quest_validated', 'quest_failed', 'application_decision',
  'quest_confirmation_needed', 'travel_arrived', 'salary_paid', 'money_received',
  'sanction', 'announcement'
));

create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('warning', 'mute', 'freeze', 'ban', 'fine')),
  reason text,
  amount numeric(15,2),
  issued_by uuid references public.profiles(id),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sanctions enable row level security;

drop policy if exists "sanctions_select" on public.sanctions;
create policy "sanctions_select" on public.sanctions for select
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'manage_users'));

create or replace function public.issue_sanction(
  p_user_id uuid,
  p_type text,
  p_reason text,
  p_amount numeric default null,
  p_duration_minutes int default null
)
returns public.sanctions
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.sanctions;
  v_expires timestamptz;
  v_target public.profiles;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;
  if p_type not in ('warning', 'mute', 'freeze', 'ban', 'fine') then
    raise exception 'Type de sanction invalide.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Impossible de se sanctionner soi-même.';
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if v_target.id is null then
    raise exception 'Membre introuvable.';
  end if;
  if v_target.is_founder and p_type in ('ban', 'freeze') then
    raise exception 'Un fondateur ne peut pas être banni ou gelé depuis cet outil.';
  end if;

  v_expires := case when p_duration_minutes is not null and p_duration_minutes > 0
    then now() + (p_duration_minutes || ' minutes')::interval
    else null
  end;

  insert into public.sanctions (user_id, type, reason, amount, issued_by, expires_at)
  values (p_user_id, p_type, p_reason, p_amount, auth.uid(), v_expires)
  returning * into v_row;

  if p_type = 'mute' then
    update public.profiles set is_muted = true, mute_until = v_expires where id = p_user_id;
  elsif p_type = 'freeze' then
    update public.profiles set is_frozen = true, freeze_until = v_expires where id = p_user_id;
  elsif p_type = 'ban' then
    update public.profiles set status = 'banned', ban_until = v_expires where id = p_user_id;
  elsif p_type = 'fine' then
    if p_amount is null or p_amount <= 0 then
      raise exception 'Montant de l''amende invalide.';
    end if;
    update public.wallets set balance = balance - p_amount where user_id = p_user_id;
    insert into public.transactions (user_id, amount, reason, created_by)
    values (p_user_id, -p_amount, coalesce('Amende : ' || p_reason, 'Amende'), auth.uid());
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    p_user_id,
    'sanction',
    case p_type
      when 'warning' then 'Avertissement'
      when 'mute' then 'Mute'
      when 'freeze' then 'Compte gelé'
      when 'ban' then 'Compte banni'
      when 'fine' then 'Amende'
    end,
    coalesce(p_reason, 'Aucune raison précisée.')
      || case when v_expires is not null then ' (jusqu''au ' || to_char(v_expires, 'DD/MM/YYYY HH24:MI') || ')' else '' end
      || case when p_type = 'fine' then ' — ' || p_amount::text || ' Cr.' else '' end,
    '/dashboard/profile'
  );

  return v_row;
end;
$$;

-- Lève une sanction avant son expiration naturelle.
create or replace function public.lift_sanction(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_s public.sanctions;
begin
  if not public.has_permission(auth.uid(), 'manage_users') then
    raise exception 'Permission refusée';
  end if;

  select * into v_s from public.sanctions where id = p_id;
  if v_s.id is null then
    raise exception 'Sanction introuvable.';
  end if;

  update public.sanctions set is_active = false where id = p_id;

  if v_s.type = 'mute' then
    update public.profiles set is_muted = false, mute_until = null where id = v_s.user_id;
  elsif v_s.type = 'freeze' then
    update public.profiles set is_frozen = false, freeze_until = null where id = v_s.user_id;
  elsif v_s.type = 'ban' then
    update public.profiles set status = 'active', ban_until = null where id = v_s.user_id;
  end if;
end;
$$;

-- Fait expirer automatiquement les sanctions temporaires échues.
create or replace function public.expire_sanctions()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set is_muted = false, mute_until = null
    where mute_until is not null and mute_until <= now() and is_muted;
  update public.profiles set is_frozen = false, freeze_until = null
    where freeze_until is not null and freeze_until <= now() and is_frozen;
  update public.profiles set status = 'active', ban_until = null
    where ban_until is not null and ban_until <= now() and status = 'banned';
  update public.sanctions set is_active = false
    where expires_at is not null and expires_at <= now() and is_active;
end;
$$;

-- Intègre l'expiration des sanctions au traitement quotidien déjà
-- déclenché à la connexion de n'importe quel membre.
create or replace function public.process_daily_economy()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.process_daily_economy_core();
  perform public.process_market();
  perform public.expire_sanctions();
end;
$$;

create or replace function public.list_my_sanctions()
returns setof public.sanctions
language sql
stable
security definer set search_path = public
as $$
  select * from public.sanctions where user_id = auth.uid() order by created_at desc;
$$;

create or replace function public.list_all_sanctions()
returns table (
  id uuid, user_id uuid, nickname text, type text, reason text, amount numeric,
  issued_by uuid, issued_by_nickname text, expires_at timestamptz, is_active boolean, created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select s.id, s.user_id, p.nickname, s.type, s.reason, s.amount,
         s.issued_by, ip.nickname, s.expires_at, s.is_active, s.created_at
  from public.sanctions s
  join public.profiles p on p.id = s.user_id
  left join public.profiles ip on ip.id = s.issued_by
  where public.has_permission(auth.uid(), 'manage_users')
  order by s.created_at desc
  limit 200;
$$;
