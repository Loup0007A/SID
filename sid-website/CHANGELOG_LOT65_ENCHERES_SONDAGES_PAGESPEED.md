# Lot 65 — Enchères, sondages, PageSpeed

## À lancer dans Supabase (dépôt sid-website)

`supabase/migrations/0080_encheres_sondages.sql` (rejouable).

## Enchères (Boutique → onglet « Enchères »)

- **Mettre en vente** : un objet de sa boutique (N exemplaires prélevés sur le
  stock, rendus si personne n'enchérit) ou une ligne de « Mes achats »
  (revente ; bouton « Revendre » sur chaque achat). Les objets à effet ne se
  revendent pas : leur effet est donné au moment de l'achat.
- Mise à prix, achat immédiat facultatif, durée de 1 h à 7 jours, mot du
  vendeur. 5 ventes en cours au plus par membre (30 pour la boutique).
- **Enchérir** : +5 % au minimum (1 z au moins). L'offre en tête est
  **bloquée sur la bourse** de l'enchérisseur et lui est rendue dès qu'il est
  dépassé (notification « Enchère dépassée »). Une offre dans les 2 dernières
  minutes prolonge la vente de 2 minutes.
- **Fin** : le gagnant reçoit l'objet dans « Mes achats », le vendeur (ou son
  entreprise) est payé, TVA déduite comme en vitrine. Notifications au
  gagnant et au vendeur. La clôture se fait à la première visite d'une page
  de la boutique après l'heure de fin (pas besoin de tâche planifiée) ;
  personne ne peut enchérir après l'heure.
- Annulation : le vendeur tant qu'il n'y a pas d'offre ; l'administration
  (boutique ou comptes) à tout moment, l'offre en tête est remboursée.
- Liste en direct (Realtime) avec rafraîchissement de secours toutes les
  20 s ; filtres En cours / Mes enchères / Terminées ; compte à rebours.

## Sondages (nouvelle page « Sondages », groupe « Le S.I.D. »)

- Créés, clos et supprimés par les admins (permission « Comptes ») ; tous les
  membres actifs votent.
- Choix unique ou multiple, vote anonyme ou public (« qui a voté quoi »),
  résultats visibles tout le temps / après avoir voté / à la clôture, date de
  clôture facultative, notification à tous les membres (désactivable).
- Le vote se modifie ou se retire tant que le sondage est ouvert.
- Sur l'accueil : le sondage ouvert auquel on n'a pas encore répondu, avec
  vote direct.

## PageSpeed

Mesuré en local avec Lighthouse sur la page d'accueil publique (mobile) :
performances 84 → 90, premier affichage 1,7 s → 0,9 s, indice de vitesse
4,0 s → 1,3 s.

| Point signalé | Correction |
| --- | --- |
| Requêtes de blocage du rendu (−310 ms) / Arborescence du réseau | CSS de l'accueil 32 Kio → 12 Kio : tout ce qui ne sert qu'au tableau de bord est passé dans `src/app/dashboard/dashboard.css`, les décors des fêtes dans `src/components/seasonal/*.css` (chargés seulement quand un décor est affiché). Polices servies depuis `public/fonts`, en caractères latins seulement, et les trois du premier affichage préchargées. Connexion à Supabase ouverte d'avance. |
| CSS inutilisé (32 Kio) | Même découpage : il reste ~11 Kio, les classes Tailwind communes à tout le site. |
| JavaScript inutilisé (43 Kio) | Le décor des fêtes n'embarque plus le client Supabase (simple requête HTTP) ; l'accueil ne précharge plus les pages Connexion et Candidater (qui l'embarquent). |
| Ancien JavaScript (12 Kio) | Les compléments de Next 14 pour très vieux navigateurs sont retirés ; navigateurs visés déclarés dans `package.json` (Safari/iOS 15.4+, Chrome/Edge/Firefox 100+). |
| Durées de mise en cache | Polices : un an ; logo et icônes : 30 jours. |
| Images au mauvais format / proportions | Logo recadré au carré (il était écrasé dans son rond) ; favicon ajoutée (la page en réclamait une : erreur 404). |
| CSP contre les attaques XSS | Politique ajoutée : scripts du site seulement, pas de plugins, `base-uri`, `form-action`, `frame-ancestors`. PageSpeed signalera encore `'unsafe-inline'` : l'enlever demande un « nonce » par page, donc de fabriquer chaque page à la demande au lieu de la servir toute prête — le site entier serait plus lent. Contrôle purement informatif, sans effet sur la note. |
| Isolation de l'origine (COOP) | `Cross-Origin-Opener-Policy: same-origin`. |
| Trusted Types | Non activé : React 18 et Next 14 ne les gèrent pas, l'activer casserait des pages. Contrôle informatif, sans effet sur la note. |

Vérifié : captures avant/après des pages publiques et du tableau de bord
identiques au pixel près (hors logo), aucune violation de la CSP sur 25 pages
(dont les titres scellés et le service worker des notifications).
