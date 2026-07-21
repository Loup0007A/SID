-- =========================================================
-- Correctif : impossible de créer une conversation (DM, groupe, ou fil de
-- candidature). `insert(...).select().single()` fait un `INSERT ... RETURNING`,
-- et la ligne retournée doit satisfaire la policy SELECT — qui exigeait
-- d'être déjà participant du salon. Au moment de l'insertion, aucun
-- participant n'existe encore (on les ajoute juste après) : la policy
-- bloquait donc la relecture, et le code croyait la création échouée alors
-- que la ligne existait bel et bien en base.
-- =========================================================

drop policy if exists "chat_channels_select" on public.chat_channels;

create policy "chat_channels_select" on public.chat_channels for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.chat_participants cp
      where cp.channel_id = id and cp.user_id = auth.uid()
    )
  );
