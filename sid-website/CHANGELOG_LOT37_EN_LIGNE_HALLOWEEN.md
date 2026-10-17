# Lot 37 — Membres en ligne et décor d'Halloween

Migration : `supabase/migrations/0063_en_ligne_halloween.sql` (après 0062).
À lancer une fois dans Supabase (SQL Editor). Vérification :

```sql
select site_decor();  -- {"halloween": true, "halloween_mode": "auto"} entre le 15 octobre et le 2 novembre
```

CGU et politique de confidentialité mises à jour sur les trois sites
(version du 17 octobre 2026) : chaque membre doit les accepter à nouveau à sa
prochaine visite.

## En ligne maintenant (accueil)
- Petit tableau de qui est sur le site **en ce moment** : avatar, pseudo,
  titre équipé, activité, depuis quand. Pastille verte = actif, orange =
  absent (onglet caché ou aucun clic depuis 5 minutes).
- Activités : « Sur l'accueil », « À la banque », « Dans la messagerie »,
  « Consulte un dossier » (sans dire lequel), « En plein donjon » / « Prépare
  des potions » / « S'entraîne aux techniques » pendant une partie,
  « Dragon dans l'arène », « Combat un dragon », « En tribune de l'arène »,
  « Dans l'administration » (sans détail pour les membres)…
- Rafraîchi toutes les 30 s. On disparaît en fermant l'onglet ou en se
  déconnectant, sinon au bout de 3 minutes sans signal (onglet caché depuis
  30 minutes : hors ligne).

### Confidentialité (Mon dossier → Présence en ligne)
- **Apparaître en ligne aux autres membres** (oui par défaut).
- **Montrer ce que je fais** (oui par défaut) ; sinon la ligne affiche
  « Activité masquée ».
- Les comptes invisibles n'apparaissent jamais aux autres membres.
- L'administration (gestion des comptes) voit tout le monde, avec la mention
  « masquée aux autres » / « invisible pour les autres ».
- Seule la page en cours est gardée (identifiants retirés), jamais
  l'historique ; la ligne est effacée un jour après la dernière visite. Elle
  fait partie de l'export « Mes données ».

## Décor d'Halloween
- Lune derrière le site, cimetière en silhouette au bas de l'écran, brume,
  toile d'araignée (et son araignée) dans le coin, « S.I.D. » à la bougie,
  ambiance violette et orangée.
- Un vol de chauves-souris à la première page de chaque visite, puis une
  retardataire de temps en temps.
- Accueil : « Halloween dans 14 nuits. Les dossiers commencent à grincer. »
- Pied de page : une citrouille à cliquer (bonbons et phrase au hasard).
- Aussi sur les pages de connexion et d'inscription.
- Rien ne capte les clics ; animations coupées si l'appareil demande moins de
  mouvement.

### Modération → Décor saisonnier
Trois réglages pour Halloween : **Automatique** (du 15 octobre au
2 novembre, heure de Paris — par défaut), **Toujours**, **Désactivé**. Le
changement s'applique tout de suite, et chaque changement est noté au journal
d'audit.

## Réglages admin (table `app_config`, facultatifs)
`presence_ttl_seconds` (180 : délai sans signal avant de passer hors ligne),
`decor_halloween` (`auto` / `on` / `off`, réglable depuis Modération).

## Fichiers
- `src/lib/presence.ts`, `src/components/presence/PresenceTracker.tsx`
  (signal), `OnlineNow.tsx` (tableau de l'accueil).
- `src/components/seasonal/Halloween.tsx` (décor, phrase, citrouille).
- Mon dossier (réglages), Modération (décor), journal d'audit, CGU /
  confidentialité (trois dépôts).
