-- =========================================================
-- Simulation de population : 100 personnages simulés (pas de vrais
-- comptes) qui touchent un salaire selon leur classe sociale et dépensent
-- dans la VRAIE économie — objets de boutique et actions d'entreprise —
-- pour donner de la vie au marché même avec peu de joueurs connectés.
--
-- Choix d'architecture :
-- - Les agents ne sont PAS des `profiles` (pas de vrai compte, pas de
--   connexion) : table dédiée `sim_agents`, sans lien de clé étrangère
--   vers `profiles`. Ça évite de polluer le trombinoscope, les
--   permissions, etc. avec 100+ faux comptes.
-- - Leurs achats modifient pour de vrai `shop_items` (stock), la
--   trésorerie/le cours/l'historique des VRAIES `businesses`, et la
--   caisse commune `tax_pool` — comme un vrai acheteur. Impossible en
--   revanche de les faire apparaître dans `purchases` ou
--   `business_shareholders` (clé étrangère vers `profiles`) : leurs achats
--   sont donc journalisés à part (`sim_events`) et leurs actions détenues
--   dans `sim_shareholdings`.
-- - Aucun job planifié : comme le reste du site (salaires, quêtes
--   expirées, marché...), la simulation "rattrape" les jours écoulés
--   quand un admin ouvre l'onglet Simulation (plafonné à 60 jours par
--   appel, pour rester rapide).
-- =========================================================

-- ---------------------------------------------------------
-- Tables
-- ---------------------------------------------------------
create table public.sim_agents (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  age int not null check (age >= 18),
  sex text not null check (sex in ('M', 'F')),
  wealth_class text not null check (wealth_class in ('pauvre', 'moyen', 'aise', 'riche')),
  weekly_salary numeric(12,2) not null,
  balance numeric(14,2) not null default 0,
  -- Traits fixes (tirés une fois à la création)
  luck int not null check (luck between 0 and 100),
  ambition int not null check (ambition between 0 and 100),
  can_have_children boolean not null default true,
  -- Humeur du jour (re-tirée chaque jour simulé, influence ses critères d'achat)
  mood text not null default 'neutre' check (mood in ('radin', 'neutre', 'depensier', 'genereux', 'inspire')),
  mood_day date not null default current_date,
  partner_id uuid references public.sim_agents(id),
  parent_a_id uuid references public.sim_agents(id),
  parent_b_id uuid references public.sim_agents(id),
  created_on_day date not null default current_date,
  created_at timestamptz not null default now()
);

create index sim_agents_partner_idx on public.sim_agents (partner_id);

create table public.sim_shareholdings (
  agent_id uuid not null references public.sim_agents(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  primary key (agent_id, business_id)
);

create table public.sim_events (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  kind text not null check (kind in ('salary', 'purchase_item', 'buy_shares', 'couple', 'child', 'tax')),
  agent_id uuid references public.sim_agents(id) on delete set null,
  amount numeric(14,2),
  detail text,
  created_at timestamptz not null default now()
);

create index sim_events_day_kind_idx on public.sim_events (day, kind);

create table public.sim_state (
  id boolean primary key default true check (id),
  last_processed_day date,
  population_cap int not null default 150
);

insert into public.sim_state (id, last_processed_day) values (true, null)
on conflict (id) do nothing;

alter table public.sim_agents enable row level security;
alter table public.sim_shareholdings enable row level security;
alter table public.sim_events enable row level security;
alter table public.sim_state enable row level security;

create policy "sim_agents_select" on public.sim_agents for select
  using (public.has_permission(auth.uid(), 'manage_economy'));
create policy "sim_shareholdings_select" on public.sim_shareholdings for select
  using (public.has_permission(auth.uid(), 'manage_economy'));
create policy "sim_events_select" on public.sim_events for select
  using (public.has_permission(auth.uid(), 'manage_economy'));
create policy "sim_state_select" on public.sim_state for select
  using (public.has_permission(auth.uid(), 'manage_economy'));

-- Aucune policy insert/update/delete : tout passe par les fonctions ci-dessous.

-- ---------------------------------------------------------
-- Données de génération (prénoms/noms), et tirages pondérés
-- ---------------------------------------------------------
create or replace function public.sim_random_from(p_options text[])
returns text
language sql
volatile
as $$
  select p_options[1 + floor(random() * array_length(p_options, 1))::int];
$$;

create or replace function public.sim_random_wealth_class()
returns text
language sql
volatile
as $$
  -- Pondérations demandées : 16% pauvre, 74% moyen, 10% aisé, 2% riche
  -- (total 102%, normalisé automatiquement par le tirage sur 0-102).
  select case
    when r < 16 then 'pauvre'
    when r < 90 then 'moyen'
    when r < 100 then 'aise'
    else 'riche'
  end
  from (select random() * 102 as r) t;
$$;

create or replace function public.sim_salary_for_class(p_class text)
returns numeric
language sql
immutable
as $$
  select case p_class
    when 'pauvre' then 200
    when 'moyen' then 1000
    when 'aise' then 2500
    when 'riche' then 10000
    else 1000
  end;
$$;

-- ---------------------------------------------------------
-- Création d'un agent (utilisée à la fois pour le peuplement initial et
-- pour une naissance). p_parent_a/b renseignés uniquement pour un enfant.
-- ---------------------------------------------------------
create or replace function public.sim_create_agent(
  p_day date,
  p_wealth_class text default null,
  p_age int default null,
  p_parent_a uuid default null,
  p_parent_b uuid default null,
  p_luck int default null,
  p_ambition int default null,
  p_starting_balance numeric default null
)
returns public.sim_agents
language plpgsql
volatile
as $$
declare
  v_first_names_m constant text[] := array['Léo','Hugo','Gabriel','Louis','Jules','Adam','Raphaël','Arthur','Nathan','Maël','Ethan','Noah','Sacha','Tom','Enzo','Mathis','Aaron','Liam','Paul','Victor'];
  v_first_names_f constant text[] := array['Emma','Jade','Louise','Alice','Chloé','Léa','Mila','Rose','Anna','Julia','Zoé','Lina','Inès','Camille','Manon','Sarah','Eva','Nina','Iris','Agathe'];
  v_last_names constant text[] := array['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fontaine'];
  v_sex text;
  v_class text;
  v_agent public.sim_agents;
begin
  v_sex := case when random() < 0.5 then 'M' else 'F' end;
  v_class := coalesce(p_wealth_class, public.sim_random_wealth_class());

  insert into public.sim_agents (
    first_name, last_name, age, sex, wealth_class, weekly_salary, balance,
    luck, ambition, can_have_children, parent_a_id, parent_b_id, created_on_day
  ) values (
    public.sim_random_from(case when v_sex = 'M' then v_first_names_m else v_first_names_f end),
    public.sim_random_from(v_last_names),
    coalesce(p_age, 18 + floor(random() * 48)::int),
    v_sex,
    v_class,
    public.sim_salary_for_class(v_class),
    coalesce(p_starting_balance, public.sim_salary_for_class(v_class) * 2),
    coalesce(p_luck, floor(random() * 101)::int),
    coalesce(p_ambition, floor(random() * 101)::int),
    random() < 0.85,
    p_parent_a,
    p_parent_b,
    p_day
  )
  returning * into v_agent;

  return v_agent;
end;
$$;

-- ---------------------------------------------------------
-- Peuplement initial (100 agents). Refuse de rejouer si déjà peuplé.
-- ---------------------------------------------------------
create or replace function public.seed_population(p_count int default 100)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  i int;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;
  if exists (select 1 from public.sim_agents limit 1) then
    raise exception 'La population a déjà été initialisée.';
  end if;

  for i in 1..greatest(1, p_count) loop
    perform public.sim_create_agent(current_date);
  end loop;

  update public.sim_state set last_processed_day = current_date - 1 where id = true;

  return p_count;
end;
$$;

-- ---------------------------------------------------------
-- Un jour de simulation pour TOUS les agents. Fonction interne (pas de
-- vérification de permission ici : appelée uniquement par
-- process_population_simulation, qui vérifie déjà les droits).
-- ---------------------------------------------------------
create or replace function public.sim_process_day(p_day date)
returns void
language plpgsql
as $$
declare
  r record;
  v_vat_rate numeric;
  v_fee_rate numeric;
  v_liquidity numeric;
  v_cap int;
  v_pop_count int;
  v_daily_salary numeric;
  v_mood text;
  v_moods constant text[] := array['radin', 'neutre', 'depensier', 'genereux', 'inspire'];
  v_buy_chance numeric;
  v_spend_mult numeric;
  v_share_bias numeric;
  v_will_buy boolean;
  v_buy_shares boolean;
  v_item public.shop_items;
  v_unit_price numeric;
  v_vat numeric;
  v_seller numeric;
  v_biz public.businesses;
  v_spend numeric;
  v_qty int;
  v_impact numeric;
  v_exec numeric;
  v_total numeric;
  v_fee numeric;
  v_tax_mult numeric;
begin
  v_vat_rate := public.get_config_numeric('vat_rate', 0.05);
  v_fee_rate := public.get_config_numeric('market_fee_rate', 0.002);
  v_liquidity := public.get_config_numeric('market_liquidity_factor', 2);
  select population_cap into v_cap from public.sim_state where id = true;
  v_cap := coalesce(v_cap, 150);

  -- Anniversaire du 1er janvier simulé : tout le monde vieillit d'un an.
  if extract(month from p_day) = 1 and extract(day from p_day) = 1 then
    update public.sim_agents set age = age + 1;
  end if;

  for r in select * from public.sim_agents order by created_at loop
    -- 1) Salaire (proraté par jour pour lisser les dépenses sur la semaine).
    v_daily_salary := round(r.weekly_salary / 7.0, 2);
    update public.sim_agents set balance = balance + v_daily_salary where id = r.id;
    insert into public.sim_events (day, kind, agent_id, amount) values (p_day, 'salary', r.id, v_daily_salary);

    -- 2) Nouvelle humeur du jour (influence ses critères de dépense).
    v_mood := v_moods[1 + floor(random() * array_length(v_moods, 1))::int];
    update public.sim_agents set mood = v_mood, mood_day = p_day where id = r.id;

    v_spend_mult := case v_mood
      when 'radin' then 0.5
      when 'depensier' then 1.7
      when 'genereux' then 1.3
      when 'inspire' then 1.15
      else 1.0
    end;
    v_buy_chance := 0.35 + case v_mood
      when 'radin' then -0.12
      when 'depensier' then 0.18
      when 'genereux' then 0.08
      when 'inspire' then 0.05
      else 0
    end;
    v_share_bias := (r.ambition / 100.0) * 0.4 + case v_mood when 'inspire' then 0.15 when 'genereux' then -0.1 else 0 end;

    -- Les riches paient deux fois plus de taxes (TVA sur achats, frais de courtage sur actions).
    v_tax_mult := case when r.wealth_class = 'riche' then 2.0 else 1.0 end;

    v_will_buy := random() < greatest(0.05, least(0.8, v_buy_chance));
    if v_will_buy and r.balance > 0 then
      v_buy_shares := random() < greatest(0.05, least(0.85, 0.3 + v_share_bias));

      if v_buy_shares then
        -- Achat d'actions : dépense une fraction du solde, dans une entreprise ouverte au hasard.
        select * into v_biz from public.businesses
          where not is_closed and shares_in_treasury > 0
          order by random() limit 1;

        if v_biz.id is not null then
          v_spend := r.balance * greatest(0.02, least(0.4, 0.08 * v_spend_mult));
          v_qty := floor(v_spend / greatest(v_biz.share_price, 0.01))::int;

          if v_qty >= 1 and v_biz.shares_in_treasury >= v_qty then
            v_impact := least(0.5, (v_qty::numeric / v_biz.share_count) * v_liquidity);
            v_exec := v_biz.share_price * (1 + v_impact / 2);
            v_total := round(v_exec * v_qty, 2);
            v_fee := round(v_total * v_fee_rate * v_tax_mult, 2);

            if r.balance >= v_total + v_fee then
              update public.sim_agents set balance = balance - (v_total + v_fee) where id = r.id;

              update public.businesses
                set treasury_balance = treasury_balance + v_total,
                    shares_in_treasury = shares_in_treasury - v_qty,
                    share_price = round(share_price * (1 + v_impact), 4)
                where id = v_biz.id;

              insert into public.sim_shareholdings (agent_id, business_id, quantity)
              values (r.id, v_biz.id, v_qty)
              on conflict (agent_id, business_id) do update set quantity = public.sim_shareholdings.quantity + v_qty;

              insert into public.business_transactions (business_id, amount, reason, created_by)
              values (v_biz.id, v_total, 'Achat de ' || v_qty || ' action(s) par un investisseur de la population', null);

              update public.tax_pool set balance = balance + v_fee where id = true;

              insert into public.business_share_price_history (business_id, price)
              values (v_biz.id, (select share_price from public.businesses where id = v_biz.id));

              insert into public.sim_events (day, kind, agent_id, amount, detail)
              values (p_day, 'buy_shares', r.id, v_total, v_qty || ' action(s) — ' || v_biz.name);
            end if;
          end if;
        end if;

      else
        -- Achat d'un objet de boutique au hasard.
        select * into v_item from public.shop_items
          where is_active and (stock is null or stock > 0)
          order by random() limit 1;

        if v_item.id is not null then
          v_unit_price := case
            when v_item.sale_price is not null and (v_item.sale_ends_at is null or v_item.sale_ends_at > now())
              then v_item.sale_price
            else v_item.price
          end;

          if r.balance >= v_unit_price then
            v_vat := round(v_unit_price * v_vat_rate * v_tax_mult, 2);
            v_seller := v_unit_price - v_vat;

            update public.sim_agents set balance = balance - v_unit_price where id = r.id;

            if v_item.business_id is not null then
              update public.businesses set treasury_balance = treasury_balance + v_seller where id = v_item.business_id;
              insert into public.business_transactions (business_id, amount, reason, created_by)
              values (v_item.business_id, v_seller, 'Vente à la population : ' || v_item.name, null);
            elsif v_item.created_by is not null then
              update public.wallets set balance = balance + v_seller where user_id = v_item.created_by;
              insert into public.transactions (user_id, amount, reason, created_by)
              values (v_item.created_by, v_seller, 'Vente à la population : ' || v_item.name, null);
            end if;

            update public.tax_pool set balance = balance + v_vat where id = true;

            if v_item.stock is not null then
              update public.shop_items set stock = stock - 1 where id = v_item.id;
            end if;

            insert into public.sim_events (day, kind, agent_id, amount, detail)
            values (p_day, 'purchase_item', r.id, v_unit_price, v_item.name);
          end if;
        end if;
      end if;
    end if;
  end loop;

  -- 3) Mise en couple (petite chance quotidienne par célibataire).
  for r in select * from public.sim_agents where partner_id is null order by random() loop
    -- revérifie : peut avoir été mis en couple plus tôt dans cette même boucle
    if (select partner_id from public.sim_agents where id = r.id) is not null then
      continue;
    end if;
    if random() < 0.012 then
      declare
        v_match uuid;
      begin
        select id into v_match from public.sim_agents
          where partner_id is null and id <> r.id
          order by random() limit 1;
        if v_match is not null then
          update public.sim_agents set partner_id = v_match where id = r.id;
          update public.sim_agents set partner_id = r.id where id = v_match;
          insert into public.sim_events (day, kind, agent_id, detail) values (p_day, 'couple', r.id, 'Nouveau couple');
        end if;
      end;
    end if;
  end loop;

  -- 4) Naissances (un couple = les deux partenaires fertiles, sous le plafond de population).
  select count(*) into v_pop_count from public.sim_agents;
  if v_pop_count < v_cap then
    for r in
      select a.* from public.sim_agents a
      join public.sim_agents b on b.id = a.partner_id
      where a.id < a.partner_id and a.can_have_children and b.can_have_children
    loop
      if random() < 0.009 then
        declare
          v_partner public.sim_agents;
          v_child public.sim_agents;
        begin
          select * into v_partner from public.sim_agents where id = r.partner_id;
          v_child := public.sim_create_agent(
            p_day,
            p_wealth_class := case when random() < 0.5 then r.wealth_class else v_partner.wealth_class end,
            p_age := 18,
            p_parent_a := r.id,
            p_parent_b := v_partner.id,
            p_luck := least(100, greatest(0, round((r.luck + v_partner.luck) / 2.0 + (random() * 20 - 10))::int)),
            p_ambition := least(100, greatest(0, round((r.ambition + v_partner.ambition) / 2.0 + (random() * 20 - 10))::int)),
            p_starting_balance := (r.weekly_salary + v_partner.weekly_salary) / 4.0
          );
          insert into public.sim_events (day, kind, agent_id, detail)
          values (p_day, 'child', v_child.id, 'Enfant de ' || r.first_name || ' ' || r.last_name || ' et ' || v_partner.first_name || ' ' || v_partner.last_name);
          v_pop_count := v_pop_count + 1;
          exit when v_pop_count >= v_cap;
        end;
      end if;
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- Point d'entrée admin : rattrape les jours écoulés depuis le dernier
-- passage (plafonné, pour rester rapide même après une longue absence).
-- ---------------------------------------------------------
create or replace function public.process_population_simulation()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_cap constant int := 60;
  v_last date;
  v_today date := current_date;
  v_processed int := 0;
  d date;
begin
  if not public.has_permission(auth.uid(), 'manage_economy') then
    raise exception 'Permission refusée';
  end if;

  if not exists (select 1 from public.sim_agents limit 1) then
    return 0;
  end if;

  select last_processed_day into v_last from public.sim_state where id = true for update;
  if v_last is null then
    v_last := v_today - 1;
  end if;

  d := v_last + 1;
  while d <= v_today and v_processed < v_cap loop
    perform public.sim_process_day(d);
    d := d + 1;
    v_processed := v_processed + 1;
  end loop;

  update public.sim_state set last_processed_day = d - 1 where id = true;

  return v_processed;
end;
$$;

-- ---------------------------------------------------------
-- Lecture : liste des agents, statistiques agrégées, activité pour le graphique.
-- ---------------------------------------------------------
create or replace function public.list_population()
returns table (
  id uuid, first_name text, last_name text, age int, sex text, wealth_class text,
  weekly_salary numeric, balance numeric, luck int, ambition int, can_have_children boolean,
  mood text, partner_name text, is_child_of_sim boolean
)
language sql
stable
security definer set search_path = public
as $$
  select
    a.id, a.first_name, a.last_name, a.age, a.sex, a.wealth_class,
    a.weekly_salary, a.balance, a.luck, a.ambition, a.can_have_children,
    a.mood,
    p.first_name || ' ' || p.last_name,
    a.parent_a_id is not null
  from public.sim_agents a
  left join public.sim_agents p on p.id = a.partner_id
  where public.has_permission(auth.uid(), 'manage_economy')
  order by a.wealth_class desc, a.last_name, a.first_name;
$$;

create or replace function public.get_population_stats()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select case when not public.has_permission(auth.uid(), 'manage_economy') then null else jsonb_build_object(
    'total', (select count(*) from sim_agents),
    'by_class', (select coalesce(jsonb_object_agg(wealth_class, cnt), '{}'::jsonb) from (select wealth_class, count(*) cnt from sim_agents group by wealth_class) t),
    'avg_age', (select round(avg(age), 1) from sim_agents),
    'couples', (select count(*) / 2 from sim_agents where partner_id is not null),
    'total_balance', (select coalesce(sum(balance), 0) from sim_agents),
    'children_born', (select count(*) from sim_agents where parent_a_id is not null),
    'last_processed_day', (select last_processed_day from sim_state where id = true)
  ) end;
$$;

create or replace function public.get_population_activity(p_days int default 30)
returns table (day date, items_bought bigint, items_amount numeric, shares_bought bigint, shares_amount numeric, children bigint)
language sql
stable
security definer set search_path = public
as $$
  select
    d.day,
    coalesce(i.cnt, 0), coalesce(i.amt, 0),
    coalesce(s.cnt, 0), coalesce(s.amt, 0),
    coalesce(c.cnt, 0)
  from (select (current_date - g) as day from generate_series(0, greatest(1, p_days) - 1) g) d
  left join (select day, count(*) cnt, sum(amount) amt from sim_events where kind = 'purchase_item' group by day) i on i.day = d.day
  left join (select day, count(*) cnt, sum(amount) amt from sim_events where kind = 'buy_shares' group by day) s on s.day = d.day
  left join (select day, count(*) cnt from sim_events where kind = 'child' group by day) c on c.day = d.day
  where public.has_permission(auth.uid(), 'manage_economy')
  order by d.day asc;
$$;
