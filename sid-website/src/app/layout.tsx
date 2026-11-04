import type { Metadata, Viewport } from "next";
// Polices servies par le site lui-même (public/fonts, déclarées dans
// globals.css) : rien n'est envoyé à Google quand on ouvre une page.
import "./globals.css";
import { SeasonalDecor } from "@/components/seasonal/Seasonal";
import { LazyCursorTrail } from "@/components/lazy/LazyCursorTrail";
import { LabelLinker } from "@/components/a11y/LabelLinker";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "S.I.D. — Dossier Central",
  description: "Plateforme communautaire du S.I.D.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "S.I.D.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b1e27",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <meta name="apple-mobile-web-app-title" content="S.I.D." />
      </head>
      <body className="font-body">
        {children}
        <SeasonalDecor />
        <LazyCursorTrail />
        <LabelLinker />
      </body>
    </html>
  );
}
