import type { Metadata, Viewport } from "next";
// Polices servies par le site lui-même (pas d'appel à Google Fonts : rien
// n'est envoyé à Google quand on ouvre une page).
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { HalloweenDecor } from "@/components/seasonal/Halloween";
import { NoelDecor } from "@/components/seasonal/Noel";

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
        {/* Nécessaires pour qu'iOS propose "Sur l'écran d'accueil" et
            traite le site comme une app installée (condition posée par
            Apple pour autoriser les notifications push sur iPhone/iPad —
            voir CHANGELOG_LOT6 pour le détail). */}
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="S.I.D." />
      </head>
      <body className="font-body">
        {children}
        <HalloweenDecor />
        <NoelDecor />
      </body>
    </html>
  );
}
