import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { DEFAULT_BRAND, brandFromConfig, setBrand, type Brand } from "@/lib/brand";
import { primeGlitched, type GlitchedMember } from "@/lib/glitch";

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

// Membres en lieu inconnu (Lot 81, migration 0117 de la Cartographie) :
// gardés 20 secondes. Le navigateur relit la liste lui-même (GlitchSync).
const loadGlitched = unstable_cache(
  async (): Promise<GlitchedMember[]> => {
    const { url, anonKey } = getSupabaseEnv();
    if (url.includes("placeholder")) return [];
    try {
      const sb = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data, error } = await sb.rpc("glitched_members");
      return !error && Array.isArray(data) ? (data as GlitchedMember[]) : [];
    } catch {
      return [];
    }
  },
  ["glitched-members"],
  { revalidate: 20, tags: ["glitched-members"] },
);

export async function getGlitched(): Promise<GlitchedMember[]> {
  const list = await loadGlitched();
  primeGlitched(list);
  return list;
}

export async function getBrand(): Promise<Brand> {
  const [b] = await Promise.all([load(), getGlitched()]);
  setBrand(b);
  return b;
}
