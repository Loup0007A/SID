import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/** Vide le cache de public_config après un changement (Modération → Rubriques). Sans effet de bord. */
export async function POST() {
  revalidateTag("public-config");
  return NextResponse.json({ ok: true });
}
