import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { DEFAULT_BRAND, brandFromConfig, setBrand, type Brand } from "@/lib/brand";

/**
 * Identité du jeu côté serveur (Lot 77) : public_config (migration 0094),
 * gardée 5 minutes. Après un changement fait depuis le site, la route
 * /api/config/revalidate vide ce cache.
 */
const load = unstable_cache(
  async (): Promise<Brand> => {
    const { url, anonKey } = getSupabaseEnv();
    if (url.includes("placeholder")) return DEFAULT_BRAND;
    try {
      const sb = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data, error } = await sb.rpc("public_config");
      if (error || !data) return DEFAULT_BRAND;
      return brandFromConfig(data as Record<string, unknown>);
    } catch {
      return DEFAULT_BRAND;
    }
  },
  ["public-config"],
  { revalidate: 300, tags: ["public-config"] },
);

export async function getBrand(): Promise<Brand> {
  const b = await load();
  setBrand(b);
  return b;
}
