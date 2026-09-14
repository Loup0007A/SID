-- =========================================================
-- Élargit la précision des montants (numeric(10,2) -> numeric(15,2), soit
-- jusqu'à 15 chiffres avant la virgule) sur toutes les colonnes liées aux
-- achats et à l'argent, pour éviter tout dépassement à mesure que
-- l'économie grossit. Le portefeuille (wallets.balance), qui accumule des
-- sommes, garde une marge supplémentaire (numeric(18,2)).
-- =========================================================

alter table public.shop_items alter column price type numeric(15,2);
alter table public.shop_items alter column sale_price type numeric(15,2);
alter table public.purchases alter column total_price type numeric(15,2);
alter table public.transactions alter column amount type numeric(15,2);
alter table public.quests alter column reward type numeric(15,2);
alter table public.salaries alter column amount type numeric(15,2);
alter table public.wallets alter column balance type numeric(18,2);
