-- =====================================================================
-- 0077 — Contrôle technique : index pour les requêtes les plus fréquentes
-- =====================================================================
-- Sans ces index, la base relit toute la table à chaque fois. Ça ne se voit
-- pas avec peu de données, puis ça ralentit à mesure que le S.I.D. grandit.
--
--  - notifications : la cloche compte les non-lues à CHAQUE page ;
--  - chat_messages : chaque conversation charge ses messages par date ;
--  - quest_participants : « mes quêtes » (accueil, quêtes, carte) cherche
--    par membre, alors que la clé commence par la quête ;
--  - purchases : « Mes achats » du Comptoir.
-- Sans effet sur le comportement du site. Rejouable sans risque.
-- =====================================================================

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where not is_read;
create index if not exists chat_messages_channel_created_idx on public.chat_messages (channel_id, created_at desc);
create index if not exists quest_participants_user_idx on public.quest_participants (user_id);
create index if not exists purchases_user_created_idx on public.purchases (user_id, created_at desc);
