import type { Metadata, Viewport } from "next";
// Polices servies par le site lui-même (public/fonts, déclarées dans
// globals.css) : rien n'est envoyé à Google quand on ouvre une page.
import "./globals.css";
import { SeasonalDecor } from "@/components/seasonal/Seasonal";
import { LazyCursorTrail } from "@/components/lazy/LazyCursorTrail";
import { LabelLinker } from "@/components/a11y/LabelLinker";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getBrand } from "@/lib/brand-server";
import { brandify } from "@/lib/brand";
import { BrandProvider } from "@/components/BrandProvider";

// Les pages prêtes à l'avance (accueil, connexion, CGU…) sont refaites toutes
// les 5 minutes : un changement de nom dans app_config y arrive sans redéployer.
export const revalidate = 300;

// Noms du jeu et du site : app_config (Lot 77, voir SETUP.md).
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return {
    title: { default: `${b.name} — ${b.site}`, template: `%s · ${b.name}` },
    description: brandify(b.description),
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: b.name,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b1e27",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = await getBrand();
  return (
    <html lang="fr">
      <head>
        {/* PageSpeed (Lot 65) : les polices du premier affichage arrivent en
            même temps que la feuille de style au lieu d'après elle, et la
            connexion à Supabase est ouverte d'avance. */}
        <link rel="preload" href="/fonts/source-serif-4-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/oswald-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/jetbrains-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preconnect" href={getSupabaseEnv().url} crossOrigin="" />
        {/* Nécessaires pour qu'iOS propose "Sur l'écran d'accueil" et
            traite le site comme une app installée (condition posée par
            Apple pour autoriser les notifications push sur iPhone/iPad —
            voir CHANGELOG_LOT6 pour le détail). */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={brand.name} />
      </head>
      <body className="font-body">
        <BrandProvider brand={brand}>
          {children}
          <SeasonalDecor />
          <LazyCursorTrail />
          <LabelLinker />
        </BrandProvider>
      </body>
    </html>
  );
}
