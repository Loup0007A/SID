import { BRAND, brandify } from "@/lib/brand";

/**
 * Couche JSX (Lot 77) : passe le texte rendu par React dans brandify().
 * Tout le site est compilé avec jsxImportSource "@/brand" (tsconfig.json).
 * Avec la configuration d'origine, rien n'est copié ni modifié.
 */

// Attributs de texte des éléments HTML/SVG ; jamais value, href, src, className…
const TEXT_PROPS = ["title", "aria-label", "aria-description", "aria-roledescription", "placeholder", "alt"] as const;
// Le contenu de ces éléments est laissé tel quel (saisie, code).
const RAW = new Set(["textarea", "code", "pre", "script", "style", "kbd"]);

// Symbole écrit à part du montant : {montant} z, <b>12</b> z, <span>z</span>.
const LEAD_Z = /^([\s\u00a0\u202f]*)z(?![\p{L}\p{N}])/u;

function text(s: string): string {
  const r = brandify(s);
  const sym = BRAND.currency.symbol;
  return sym !== "z" && LEAD_Z.test(r) ? r.replace(LEAD_Z, (_m, sp: string) => `${sp}${sym}`) : r;
}

function child(c: unknown): unknown {
  if (typeof c === "string") return text(c);
  if (Array.isArray(c)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < c.length; i++) {
      const v = child(c[i]);
      if (v !== c[i]) {
        out ??= c.slice();
        out[i] = v;
      }
    }
    return out ?? c;
  }
  return c;
}

export function brandProps(type: unknown, props: Record<string, unknown> | null | undefined) {
  if (BRAND.isDefault || !props) return props;
  const host = typeof type === "string";
  if (host && RAW.has(type)) return props;
  let out: Record<string, unknown> | null = null;
  const set = (k: string, v: unknown) => {
    if (v === props[k]) return;
    out ??= { ...props };
    out[k] = v;
  };
  if ("children" in props) set("children", child(props.children));
  // Aussi sur les composants (Link de Next…), qui les transmettent à leur balise.
  for (const k of TEXT_PROPS) if (typeof props[k] === "string") set(k, brandify(props[k] as string));
  if (host) {
    if (type === "meta" && typeof props.content === "string") set("content", brandify(props.content));
    if (type === "option" && typeof props.label === "string") set("label", brandify(props.label));
  }
  return out ?? props;
}
