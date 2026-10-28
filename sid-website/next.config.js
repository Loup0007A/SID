// Contrôle technique (Lot 61) : en-têtes de sécurité sur toutes les pages.
//  - nosniff : le navigateur ne devine pas le type d'un fichier ;
//  - SAMEORIGIN : le site ne peut pas être affiché dans un cadre d'un autre site
//    (protection contre le « clickjacking », ex. un faux bouton posé sur la Banque) ;
//  - Referrer-Policy : les adresses complètes ne fuient pas vers les autres sites.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aucune page n'utilise next/image : l'optimiseur d'images de Next est coupé
  // (/_next/image répond 404), ce qui écarte ses failles connues.
  images: { unoptimized: true },
  // Images du dossier public (logo, icônes) : gardées un jour par le
  // navigateur au lieu d'être revérifiées à chaque page.
  async headers() {
    const cache = [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }];
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/logo.webp', headers: cache },
      { source: '/logo.png', headers: cache },
      { source: '/icons/:path*', headers: cache },
    ];
  },
};

module.exports = nextConfig;
