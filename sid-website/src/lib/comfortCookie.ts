import type { NextRequest, NextResponse } from "next/server";
import { COMFORT_COOKIE } from "./comfortPrefs";

/**
 * Appareil neuf (Lot 95) : la première page d'un membre connecté sans cookie
 * « sid-confort » attend la lecture de ses réglages d'affichage sur le compte
 * et les pose dans le cookie, que le script du <head> lit avant d'afficher.
 * Une seule fois par appareil et par site ; ensuite le cookie suffit.
 * Délai court : si la base tarde, la page part sans, et ComfortSync rattrape.
 * Fichier identique sur les trois sites.
 */
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;
const WAIT_MS = 700;

function base64UrlToText(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function accessToken(request: NextRequest): string | null {
  const all = request.cookies.getAll().filter((c) => AUTH_COOKIE.test(c.name) && c.value);
  if (!all.length) return null;
  const base = all[0].name.replace(/\.\d+$/, "");
  const whole = all.find((c) => c.name === base);
  let raw = whole
    ? whole.value
    : all
        .filter((c) => c.name.startsWith(base + "."))
        .sort((a, b) => Number(a.name.slice(base.length + 1)) - Number(b.name.slice(base.length + 1)))
        .map((c) => c.value)
        .join("");
  try {
    raw = raw.startsWith("base64-") ? base64UrlToText(raw.slice(7)) : decodeURIComponent(raw);
    const s = JSON.parse(raw);
    const token = typeof s?.access_token === "string" ? s.access_token : Array.isArray(s) ? s[0] : null;
    if (typeof token !== "string") return null;
    const exp = JSON.parse(base64UrlToText(token.split(".")[1])).exp;
    return typeof exp === "number" && exp > Date.now() / 1000 + 30 ? token : null;
  } catch {
    return null;
  }
}

export async function withComfortCookie(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  if (request.cookies.has(COMFORT_COOKIE)) return response;
  // Seulement pour une vraie page (pas les préchargements ni les données).
  if (request.headers.get("sec-fetch-dest") !== "document" || request.headers.has("next-router-prefetch")) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = accessToken(request);
  if (!url || !key || !token) return response;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/display_prefs_get`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(WAIT_MS),
      cache: "no-store",
    });
    if (!res.ok) return response;
    const prefs = await res.json();
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return response;
    response.cookies.set(COMFORT_COOKIE, JSON.stringify(prefs), { path: "/", maxAge: 31536000, sameSite: "lax", httpOnly: false });
  } catch {
    /* base lente ou injoignable : ComfortSync rattrapera */
  }
  return response;
}
