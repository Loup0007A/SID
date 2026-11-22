import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Vide le cache de public_config après un changement (Modération → Rubriques).
 * Réservé aux membres connectés (Lot 96) : sans session, n'importe qui
 * pouvait vider le cache en boucle.
 */
export async function POST() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  revalidateTag("public-config", "max");
  return NextResponse.json({ ok: true });
}
