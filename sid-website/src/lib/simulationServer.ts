import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { SimulationKind } from "@/lib/simulationSites";

/**
 * Outils serveur des simulations (jamais importés côté navigateur).
 *
 * Le JETON d'une partie est un secret à usage unique : 32 octets tirés au
 * hasard, en hexadécimal (64 caractères). Il est donné à l'iframe ; la base
 * n'en garde que l'empreinte SHA-256, donc même une fuite de la table
 * `simulation_runs` ne permettrait pas d'envoyer un résultat.
 */

export function newRunToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashRunToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isRunToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/**
 * Signature facultative des résultats. Si la variable d'environnement
 * SIMULATION_SECRET_<SIMULATION> existe (ex. SIMULATION_SECRET_DONJONS),
 * l'API EXIGE l'en-tête X-SID-Signature : HMAC-SHA256 du texte
 * `<jeton>.<1 ou 0>` avec ce secret, en hexadécimal.
 *
 * Ça n'a de sens que si le site de la simulation a son propre serveur pour
 * garder le secret : un site entièrement statique (comme une page GitHub
 * Pages) ne peut rien cacher, donc on ne configure pas de secret pour lui.
 */
export function siteSecret(kind: SimulationKind): string | null {
  return process.env[`SIMULATION_SECRET_${kind.toUpperCase()}`] || null;
}

export function signResult(secret: string, token: string, success: boolean): string {
  return createHmac("sha256", secret).update(`${token}.${success ? 1 : 0}`).digest("hex");
}

export function verifySignature(
  kind: SimulationKind,
  token: string,
  success: boolean,
  signature: string | null
): "ok" | "missing" | "invalid" {
  const secret = siteSecret(kind);
  if (!secret) return "ok";
  if (!signature) return "missing";
  const expected = Buffer.from(signResult(secret, token, success), "hex");
  const given = Buffer.from(signature.trim().toLowerCase(), "hex");
  if (given.length !== expected.length) return "invalid";
  return timingSafeEqual(given, expected) ? "ok" : "invalid";
}

/**
 * Les routes appelées par les sites des simulations acceptent toutes les
 * origines : elles n'utilisent aucun cookie, seul le jeton (secret) compte.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-SID-Signature",
  "Access-Control-Max-Age": "86400",
};

export function corsJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
