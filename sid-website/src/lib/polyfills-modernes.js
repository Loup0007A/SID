// Remplace les « polyfills » que Next 14 ajoute d'office au JavaScript du site
// (Array.prototype.at, Object.hasOwn, flat, trimStart…). Tous les navigateurs
// visés (champ « browserslist » de package.json : Safari/iOS 15.4 et plus,
// Chrome, Edge et Firefox 100 et plus) les ont déjà. Signalé par PageSpeed
// (« Ancien JavaScript », Lot 65). Voir next.config.js.
