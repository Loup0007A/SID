-- =========================================================
-- Édition / suppression des messages + mise en forme basique (gras,
-- italique, couleur). La suppression est une suppression "douce" (on garde
-- la ligne avec is_deleted = true) pour ne pas casser l'affichage
-- chronologique ni les abonnements Realtime déjà en place — le contenu
-- affiché devient juste "Message supprimé".
-- =========================================================

alter table public.chat_messages add column edited_at timestamptz;
alter table public.chat_messages add column is_deleted boolean not null default false;
alter table public.chat_messages add column is_bold boolean not null default false;
alter table public.chat_messages add column is_italic boolean not null default false;
alter table public.chat_messages add column color text; -- couleur hex optionnelle, ex: '#D99A9A'

-- Seul l'auteur peut modifier/supprimer son propre message, et uniquement
-- son contenu/mise en forme/statut de suppression — pas le salon ni
-- l'auteur, pour éviter de réattribuer un message à quelqu'un d'autre.
create policy "chat_messages_update_own" on public.chat_messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Renseigne edited_at automatiquement dès que le contenu ou la mise en
-- forme change (mais pas lors d'une simple suppression, pour distinguer
-- "modifié" de "supprimé" dans l'interface).
create or replace function public.set_message_edited_at()
returns trigger
language plpgsql
as $$
begin
  if (new.content is distinct from old.content
      or new.is_bold is distinct from old.is_bold
      or new.is_italic is distinct from old.is_italic
      or new.color is distinct from old.color)
     and new.is_deleted = false then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_chat_messages_edited_at
  before update on public.chat_messages
  for each row execute function public.set_message_edited_at();
