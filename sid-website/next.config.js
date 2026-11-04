const path = require('path');

// Politique de sécurité du contenu (Lot 65, PageSpeed) :
//  - script-src : seuls les scripts du site lui-même s'exécutent (un script
//    injecté depuis un autre site est refusé). 'unsafe-inline' reste
//    nécessaire : Next 14 écrit des petits scripts dans chaque page, et les
//    autoriser un par un (« nonce ») obligerait à fabriquer chaque page à la
//    demande au lieu de la servir toute prête — tout le site serait plus lent ;
//  - object-src 'none' : pas de plugins (<object>, <embed>) ;
//  - base-uri / form-action : une balise ou un formulaire injecté ne peut pas
//    envoyer les visiteurs (ou leurs saisies) ailleurs ;
//  - frame-ancestors : pas d'affichage dans le cadre d'un autre site ;
//  - worker-src : le service worker des notifications push.
// Les images, connexions (Supabase) et cadres (simulations) ne sont pas
// restreints ici.
const CSP = [
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://vercel.live`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "worker-src 'self' blob:",
].join('; ');

// Contrôle technique (Lot 61) : en-têtes de sécurité sur toutes les pages.
//  - nosniff : le navigateur ne devine pas le type d'un fichier ;
//  - SAMEORIGIN : le site ne peut pas être affiché dans un cadre d'un autre site
//    (protection contre le « clickjacking », ex. un faux bouton posé sur la Banque) ;
//  - Referrer-Policy : les adresses complètes ne fuient pas vers les autres sites ;
//  - Cross-Origin-Opener-Policy (Lot 65) : une fenêtre ouverte par un autre
//    site ne peut pas manipuler celle du S.I.D. (et inversement).
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: CSP },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aucune page n'utilise next/image : l'optimiseur d'images de Next est coupé
  // (/_next/image répond 404), ce qui écarte ses failles connues.
  images: { unoptimized: true },
  // Fichiers du dossier public (Lot 65, PageSpeed) : les polices ne changent
  // jamais (un an, « immutable ») ; le logo et les icônes sont gardés 30
  // jours (si l'un d'eux change, ajouter ?v=2 à son adresse dans le code).
  async headers() {
    const month = [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }];
    const year = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/fonts/:path*', headers: year },
      { source: '/logo.webp', headers: month },
      { source: '/logo.png', headers: month },
      { source: '/favicon.ico', headers: month },
      { source: '/icons/:path*', headers: month },
    ];
  },
  // Les « polyfills » de Next pour les très vieux navigateurs sont retirés
  // du JavaScript envoyé (voir src/lib/polyfills-modernes.js).
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]build[\\/]polyfills[\\/]polyfill-module(\.js)?$/,
          path.resolve(__dirname, 'src/lib/polyfills-modernes.js'),
        ),
      );
    }
    return config;
  },
};

module.exports = nextConfig;
