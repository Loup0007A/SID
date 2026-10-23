/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Images du dossier public (logo, icônes) : gardées un jour par le
  // navigateur au lieu d'être revérifiées à chaque page.
  async headers() {
    const cache = [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }];
    return [
      { source: '/logo.webp', headers: cache },
      { source: '/logo.png', headers: cache },
      { source: '/icons/:path*', headers: cache },
    ];
  },
};

module.exports = nextConfig;
