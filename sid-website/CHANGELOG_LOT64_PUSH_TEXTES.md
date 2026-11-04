# Lot 64 — Notifications push, barre du haut, textes

## À lancer dans Supabase (dépôt sid-website)

`supabase/migrations/0079_push.sql` (rejouable).

## Notifications push

### Ce qui a été corrigé dans le code
- **Messagerie** : les notifications de conversation sont regroupées (le
  compteur augmente) ; seul le premier message non lu déclenchait un push. Le
  push part maintenant à chaque nouveau message (« 3 nouveaux messages · … »),
  et la notification d'une même conversation remplace la précédente.
- **iPhone** : l'autorisation est demandée tout de suite au toucher du bouton
  (Safari refuse sinon), puis le service worker et l'abonnement.
- **Abonnement** : repris automatiquement si l'appareil servait à un autre
  compte ; refait si les clés VAPID ont changé ; renvoyé au serveur une fois
  par jour (au cas où il aurait été effacé).
- **Service worker** : nouvelle version active tout de suite ; le clic sur une
  notification ramène l'onglet ou l'app déjà ouverts sur la bonne page.
- **Icônes carrées** de l'app (192, 512, iPhone 180) ; l'ancienne icône
  (198 × 156) n'était pas carrée.

### Nouveau panneau (Mon dossier → Notifications push)
État de l'appareil (navigateur, app installée sur iPhone, autorisation,
abonnement), « M'envoyer un test » (direct, sans passer par la base), « Test
complet » (base → pg_net → site → appareil), et pour les admins un
**diagnostic serveur** : pg_net, réglages `app_config`, et les dernières
réponses du site à la base avec leur explication (401 = secret différent,
404 = mauvaise adresse, 501 = clés VAPID absentes…).

### Configuration nécessaire (à vérifier une fois)
1. **Vercel → Settings → Environment Variables** (projet sid-quest), puis
   redéployer :
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` : une paire générée
     avec `npx web-push generate-vapid-keys` ;
   - `VAPID_SUBJECT` : `mailto:ton@adresse` (une vraie adresse : Apple refuse
     sinon) ;
   - `PUSH_WEBHOOK_SECRET` : un long texte au hasard ;
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé `service_role` de Supabase.
2. **Supabase → Database → Extensions** : activer `pg_net`.
3. **Supabase → SQL Editor** :
   ```sql
   insert into public.app_config (key, value) values
     ('site_url', 'https://sid-quest.vercel.app'),
     ('push_webhook_secret', '<le même texte que PUSH_WEBHOOK_SECRET>')
   on conflict (key) do update set value = excluded.value;
   ```
4. Sur chaque appareil : Mon dossier → « Activer sur cet appareil », puis
   « M'envoyer un test ». Sur iPhone : d'abord Safari → Partager → « Sur l'écran
   d'accueil », ouvrir l'app depuis l'icône, puis activer.

Si un appareil avait été activé avant ce lot, le désactiver puis le réactiver.

## Barre du haut sur téléphone

Les boutons de droite recouvraient « ← Accueil » (surtout pour un admin avec
des alertes). Sur téléphone : flèche seule (le titre de la page est déjà
dessous), logo masqué hors de l'accueil, badge d'alertes masqué (il reste
dans « À faire » sur l'accueil), espacements réduits. Vérifié sans
chevauchement de 320 à 390 px de large, membre et admin.

## Textes

33 phrases supprimées ou raccourcies sur les trois sites : celles qui
expliquaient l'évidence (« Touche un objet pour le voir en grand »,
« Choisis une discussion à gauche… », « Glisse pour naviguer · molette pour
zoomer… ») ou présentaient la page pour rien (sous-titres du tableau des
missions, des Chroniques, du Guide, du Comptoir). Les règles du jeu utiles,
les textes légaux et le tutoriel sont gardés.
