import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Client Supabase avec la clé `service_role` / `secret`, qui contourne le
 * RLS et peut appeler l'API d'administration Auth (créer/bannir un
 * utilisateur, changer son mot de passe, etc.).
 *
 * ⚠️ NE JAMAIS importer ce fichier depuis un composant "use client" ou
 * l'exposer côté navigateur : la clé service_role donne un accès total à
 * la base. Utilisation strictement réservée aux routes API (`src/app/api`)
 * qui vérifient elles-mêmes la permission de l'appelant avant d'agir.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) n'est pas configurée. " +
        "Ajoute-la dans les variables d'environnement du projet pour utiliser les actions d'administration."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
