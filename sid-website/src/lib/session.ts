import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Utilisateur de la session en cours, lu sur place (cookie de session) :
 * aucun aller-retour réseau, sauf si le jeton doit être rafraîchi.
 *
 * Remplace `supabase.auth.getUser()` côté navigateur, qui interrogeait le
 * serveur d'authentification à chaque appel (une fois par page, souvent
 * plusieurs). Les données restent protégées par la base (RLS) : le jeton
 * envoyé à chaque requête est vérifié là-bas.
 *
 * Même forme de retour que `getUser()` pour remplacer l'appel tel quel.
 */
export async function currentUser(): Promise<{ data: { user: User | null } }> {
  const { data } = await createClient().auth.getSession();
  return { data: { user: data.session?.user ?? null } };
}

/** Identifiant du membre connecté (ou null). */
export async function currentUserId(): Promise<string | null> {
  return (await currentUser()).data.user?.id ?? null;
}
