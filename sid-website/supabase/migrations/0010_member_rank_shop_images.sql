-- =========================================================
-- Rang personnel du membre (E à S, même échelle que les quêtes),
-- affiché comme une "carte de niveau" sur son profil.
-- =========================================================
alter table public.profiles add column member_rank text not null default 'E'
  check (member_rank in ('E', 'D', 'C', 'B', 'A', 'S'));

-- =========================================================
-- Image pour les objets de la boutique (bucket de stockage)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('shop-items', 'shop-items', true)
on conflict (id) do nothing;

create policy "shop_item_image_upload" on storage.objects for insert
  with check (bucket_id = 'shop-items' and public.has_permission(auth.uid(), 'manage_shop'));

create policy "shop_item_image_update" on storage.objects for update
  using (bucket_id = 'shop-items' and public.has_permission(auth.uid(), 'manage_shop'));

create policy "shop_item_image_delete" on storage.objects for delete
  using (bucket_id = 'shop-items' and public.has_permission(auth.uid(), 'manage_shop'));

create policy "shop_item_image_public_read" on storage.objects for select
  using (bucket_id = 'shop-items');
