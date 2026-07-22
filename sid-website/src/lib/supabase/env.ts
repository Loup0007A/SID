/**
 * Résout l'URL et la clé publique Supabase, quelle que soit la façon dont
 * elles ont été configurées :
 * - via l'intégration native Vercel "Connect Supabase" (Marketplace), qui
 *   génère NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   (éventuellement préfixées par le nom donné à la ressource, ex: TEST_,
 *   si plusieurs projets Supabase sont connectés au même projet Vercel)
 * - via une configuration manuelle suivant le README (NEXT_PUBLIC_SUPABASE_URL
 *   + NEXT_PUBLIC_SUPABASE_ANON_KEY, noms historiques du tableau de bord Supabase)
 *
 * Si rien n'est défini (ex: pré-rendu au moment du build), on retombe sur
 * des valeurs factices pour ne jamais faire planter le build : les vrais
 * appels réseau n'ont de toute façon lieu que côté navigateur.
 *
 * ⚠️ Ces variables doivent être écrites littéralement (process.env.NOM_EXACT)
 * car Next.js les remplace au moment du build par analyse statique du code
 * source : impossible de "scanner" process.env dynamiquement côté navigateur.
 * Si le préfixe change encore (nouvel environnement/projet connecté), le plus
 * simple et le plus durable est d'ajouter dans Vercel deux variables "propres"
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY qui recopient les
 * bonnes valeurs, plutôt que de rajouter un cas ici à chaque fois.
 */
export function getSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_TEST_SUPABASE_URL ||
    "https://placeholder.supabase.co";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || // intégration Vercel native
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || // configuration manuelle (README)
    process.env.NEXT_PUBLIC_TEST_SUPABASE_PUBLISHABLE_KEY || // intégration Vercel, ressource "test"
    process.env.NEXT_PUBLIC_TEST_SUPABASE_ANON_KEY ||
    "placeholder-anon-key";

  return { url, anonKey };
}
