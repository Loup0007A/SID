import { NextResponse } from "next/server";
import { getBrand } from "@/lib/brand-server";
import { brandify } from "@/lib/brand";

/** Manifeste de l'application installée, avec les noms de app_config (Lot 77). */
// Relu à chaque demande (rare) : un changement de nom s'y voit tout de suite.
export const dynamic = "force-dynamic";

const REST = {
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "background_color": "#1b1e27",
  "theme_color": "#1b1e27",
  "icons": [
    {
      "src": "/icons/app-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/app-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/app-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "id": "/dashboard"
};

export async function GET() {
  const b = await getBrand();
  return NextResponse.json(
    { name: `${b.name} — ${b.site}`, short_name: b.name, description: brandify(b.description), ...REST },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" } },
  );
}
