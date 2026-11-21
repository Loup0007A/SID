// En-têtes de sécurité des trois sites (Lot 96). Fichier identique dans les
// trois dépôts (npm run communs), lu par next.config.js.
//
// Politique de sécurité du contenu (Lot 65) :
//  - script-src : seuls les scripts du site lui-même s'exécutent (un script
//    injecté depuis un autre site est refusé). 'unsafe-inline' reste
//    nécessaire : Next 14 écrit des petits scripts dans chaque page, et les
//    autoriser un par un (« nonce ») obligerait à fabriquer chaque page à la
//    demande au lieu de la servir toute prête ;
//  - object-src 'none' : pas de plugins (<object>, <embed>) ;
//  - base-uri / form-action : une balise ou un formulaire injecté ne peut pas
//    envoyer les visiteurs (ou leurs saisies) ailleurs ;
//  - frame-ancestors : pas d'affichage dans le cadre d'un autre site ;
//  - worker-src : service workers (notifications push, Carto hors ligne).
// Les images, connexions (Supabase) et cadres (simulations) ne sont pas
// restreints ici.
//
// Autres en-têtes (Lot 61, 65, 96) :
//  - nosniff : le navigateur ne devine pas le type d'un fichier ;
//  - SAMEORIGIN : pas d'affichage dans un cadre d'un autre site
//    (« clickjacking », ex. un faux bouton posé sur la Banque) ;
//  - Referrer-Policy : les adresses complètes ne fuient pas vers les autres sites ;
//  - Cross-Origin-Opener-Policy : une fenêtre ouverte par un autre site ne
//    peut pas manipuler celle du S.I.D. (et inversement) ;
//  - Strict-Transport-Security : HTTPS seulement, pendant deux ans ;
//  - Permissions-Policy : caméra, micro, position, paiement, USB, Bluetooth
//    coupés (aucun site ne s'en sert ; une page piégée ne peut pas les demander).
const dev = process.env.NODE_ENV === 'development';

const CSP = [
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://vercel.live`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "worker-src 'self' blob:",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: CSP },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), browsing-topics=()',
  },
];

module.exports = { SECURITY_HEADERS, CSP };
