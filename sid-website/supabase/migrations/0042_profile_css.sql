-- =========================================================
-- CSS personnalisé par membre, visible des autres, pour 4 zones distinctes
-- du site — chacune a son propre CSS, indépendant des trois autres :
--   'org_chart'   -> la carte du membre dans l'organigramme
--   'roster'      -> sa carte dans le trombinoscope
--   'leaderboard' -> sa ligne dans le classement
--   'profile'     -> sa fiche de profil (vue par les autres)
--
-- Le CSS brut est stocké tel quel ; c'est le FRONT qui le "scope" (préfixe
-- chaque sélecteur par la classe unique du membre, ex. .profile-skin-<id>)
-- et le nettoie (retire url(), @import, position:fixed, etc.) juste avant
-- de l'injecter dans un <style>, à CHAQUE affichage — voir
-- src/lib/profileCss.ts. Cette fonction ne peut donc matcher que des
-- éléments à l'intérieur de la carte/ligne du membre lui-même, jamais le
-- reste de la page.
--
-- En plus de ça (défense en profondeur, côté base) : longueur plafonnée et
-- refus des constructions les plus dangereuses (@import, url(), expression,
-- -moz-binding, behavior, javascript:) au moment de l'enregistrement.
-- =========================================================

create table public.profile_styles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  section text not null check (section in ('org_chart', 'roster', 'leaderboard', 'profile')),
  css text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, section)
);

alter table public.profile_styles enable row level security;

-- Tout le monde doit pouvoir LIRE le CSS de tout le monde (c'est fait pour
-- être affiché aux autres) ; seule l'écriture est restreinte (via la
-- fonction ci-dessous, jamais par un insert/update direct).
create policy "profile_styles_select_all" on public.profile_styles for select using (true);

create or replace function public.set_profile_css(p_section text, p_css text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_css text := coalesce(p_css, '');
begin
  if p_section not in ('org_chart', 'roster', 'leaderboard', 'profile') then
    raise exception 'Section invalide.';
  end if;

  if length(v_css) > 8000 then
    raise exception 'CSS trop long (8000 caractères maximum, actuellement %).', length(v_css);
  end if;

  if v_css ~* '@import|expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:' then
    raise exception 'CSS refusé : construction interdite détectée (@import, expression(), behavior, -moz-binding ou javascript:).';
  end if;

  if v_css ~* 'url\s*\(' then
    raise exception 'CSS refusé : url(...) n''est pas autorisé (ça pourrait charger une ressource externe).';
  end if;

  insert into public.profile_styles (user_id, section, css, updated_at)
  values (auth.uid(), p_section, v_css, now())
  on conflict (user_id, section) do update
    set css = excluded.css, updated_at = now();
end;
$$;

-- Remet une section à vide (raccourci pratique côté UI).
create or replace function public.reset_profile_css(p_section text)
returns void
language sql
security definer set search_path = public
as $$
  select public.set_profile_css(p_section, '');
$$;

-- Le CSS complet (les 4 sections) d'UN membre, pour l'écran de réglages.
create or replace function public.get_my_profile_css()
returns setof public.profile_styles
language sql
stable
security definer set search_path = public
as $$
  select * from public.profile_styles where user_id = auth.uid();
$$;

-- Récupère en un seul appel le CSS d'UNE section pour une LISTE de membres
-- (utile pour le trombinoscope, l'organigramme, le classement, qui
-- affichent plusieurs membres à la fois).
create or replace function public.get_profile_css_for(p_section text, p_user_ids uuid[])
returns table (user_id uuid, css text)
language sql
stable
security definer set search_path = public
as $$
  select ps.user_id, ps.css
  from public.profile_styles ps
  where ps.section = p_section
    and ps.user_id = any(p_user_ids)
    and length(trim(ps.css)) > 0;
$$;
