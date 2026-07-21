import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// IMPORTANT: on garde UN SEUL objet `response`, mis à jour en place à
// chaque cookie. Le recréer à chaque cookie (comme le faisait une
// ancienne version de ce fichier) écrase les cookies précédents et casse
// la session à chaque requête — c'était le bug de la déconnexion au reload.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        // on répercute d'abord sur la requête (pour que le reste de ce
        // passage de middleware voie les cookies à jour)...
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // ...puis on reconstruit la réponse UNE fois avec la requête à jour,
        // et on pose tous les cookies dessus.
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Ne jamais ajouter de logique entre createServerClient et getUser() :
  // c'est cet appel qui rafraîchit le token si besoin.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
