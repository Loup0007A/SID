import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde du tableau de bord : un visiteur sans session est renvoyé vers
 * /login avant tout affichage.
 *
 * Volontairement minimal (rapidité) : on regarde seulement si le cookie de
 * session Supabase est présent, sans appeler Supabase. Avant, chaque page
 * (et chaque préchargement de lien) attendait un aller-retour vers le
 * serveur d'authentification ici même.
 * - Le jeton est rafraîchi par le navigateur (client Supabase) et, pour les
 *   routes /api, par le client serveur de chaque route.
 * - Un cookie expiré ou révoqué laisse passer jusqu'à la page, qui renvoie
 *   alors vers /login (voir le layout du tableau de bord).
 * - Les données restent protégées côté base (RLS) : ce garde ne sert qu'à
 *   éviter d'afficher une page vide à un visiteur non connecté.
 */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((c) => SESSION_COOKIE.test(c.name) && c.value.length > 0);

  // La page d'accueil publique : un membre connecté va directement à son
  // tableau de bord. (Session expirée : le tableau de bord renvoie vers
  // /login, qui ne renvoie pas ici, donc pas de boucle.)
  if (request.nextUrl.pathname === "/") {
    if (!hasSession) return NextResponse.next();
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    return NextResponse.redirect(dash);
  }

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
