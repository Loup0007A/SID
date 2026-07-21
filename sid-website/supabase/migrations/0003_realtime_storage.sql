-- Active le Realtime sur les messages de chat pour un affichage instantané
alter publication supabase_realtime add table public.chat_messages;

-- Bucket de stockage pour les photos de profil
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Chacun peut uploader/mettre à jour sa propre photo (dossier nommé par son user id)
create policy "avatar_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
