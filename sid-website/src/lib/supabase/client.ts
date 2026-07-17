import { createBrowserClient } from "@supabase/ssr";

// Si les variables d'environnement ne sont pas encore configurées (typiquement
// pendant le pré-rendu statique côté serveur au moment du build, avant même
// qu'un navigateur n'exécute quoi que ce soit), on utilise des valeurs de
// substitution pour ne jamais faire planter le build. Les vrais appels réseau
// n'ont de toute façon lieu que côté navigateur, dans les hooks useEffect.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(url, key);
}
