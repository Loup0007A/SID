# Lot 51 : le nombre d'actions suit la demande

**Migration : `supabase/migrations/0070_emission_actions.sql`**, à lancer après `0069` (peut être relancée).

Avant, le stock d'actions d'une entreprise ne grossissait presque jamais (une
fois par semaine au plus, et seulement avec un très gros chiffre d'affaires) :
les actions en vente partaient vite et il n'en revenait pas.

## Émission sur demande (nouveau)
- Chaque action achetée dans le stock d'une entreprise (par un membre ou par
  la population simulée) est comptée ; une action revendue à l'entreprise
  est décomptée.
- Toutes les **8 heures** au plus, si **moins de 25 %** du capital reste à
  vendre, l'entreprise émet de nouvelles actions : **80 %** de ce qui a été
  acheté depuis la dernière émission, entre **2 %** et **20 %** du capital
  d'un coup.
- Le fondateur reçoit une notification (« 📈 Ma Société émet 150 actions »),
  et l'émission est inscrite au registre de l'entreprise.
- Les entreprises déjà vidées au moment de la migration ne restent pas
  bloquées : les actions détenues par le public comptent comme demande de
  départ, donc leur première émission arrive dans les 5 minutes qui suivent
  (jusqu'à 20 % du capital), puis toutes les 8 h tant qu'on achète.

## Augmentation de capital sur activité (plus généreuse)
- Seuil de chiffre d'affaires sur 7 jours : **3 %** de la capitalisation (au
  lieu de 5 %) ; **+4 %** d'actions (au lieu de 2 %) ; tous les **3 jours**
  au plus (au lieu de 7). Ces réglages ne changent que s'ils étaient encore
  aux valeurs d'origine.

## À l'écran
- Page Entreprise : explication des deux mécanismes, et « Stock bas en ce
  moment : une émission arrive » quand c'est le cas.
- Bourse : « stock bas : de nouvelles actions seront émises » à côté du
  nombre d'actions disponibles.

Tous les chiffres sont réglables dans `app_config` (`business_issue_*`,
`business_growth_*`).
