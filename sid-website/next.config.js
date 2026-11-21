const path = require('path');

// En-têtes de sécurité : en-tetes-securite.js (identique sur les trois sites).
const { SECURITY_HEADERS } = require('./en-tetes-securite');

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
    // Lot 77 : tout le site passe par la couche JSX de src/brand (tsconfig
    // jsxImportSource). Changer cette version force la recompilation de tous
    // les fichiers, y compris ceux que le cache de build (Vercel compris)
    // garderait compilés avec l'ancienne couche.
    if (config.cache && typeof config.cache === 'object') {
      config.cache.version = `${config.cache.version || ''}|jsx-brand-2`;
    }
    // Composants scellés (titres, déjà compilés en JS) : leur JSX passe aussi
    // par la couche du site, sans toucher à leur code.
    config.module.rules.push({
      test: /[\\/]src[\\/]components[\\/]sceaux[\\/][^\\/]+\.js$/,
      resolve: {
        alias: {
          'react/jsx-runtime$': path.resolve(__dirname, 'src/brand/jsx-runtime.ts'),
          'react/jsx-dev-runtime$': path.resolve(__dirname, 'src/brand/jsx-dev-runtime.ts'),
        },
      },
    });
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
