import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Client sans session (lecture publique seulement, comme un visiteur non
 * connecté). Sans cookies, la page qui l'utilise peut être préparée à
 * l'avance et servie directement par le CDN (voir la page d'accueil).
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
