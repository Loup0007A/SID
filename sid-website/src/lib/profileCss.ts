/**
 * Nettoie et "scope" le CSS personnalisé d'un membre avant de l'injecter
 * dans la page pour les autres visiteurs.
 *
 * Le serveur refuse déjà (voir set_profile_css) les constructions les plus
 * dangereuses à l'enregistrement, mais la protection qui compte vraiment
 * est ICI : quoi qu'il y ait en base, seul le résultat de cette fonction
 * est injecté dans un <style>, à chaque affichage. Elle :
 *  - retire les commentaires ;
 *  - supprime toute règle @ autre que @media (donc @import, @font-face,
 *    @keyframes, @page, @namespace... disparaissent, avec tout leur bloc) ;
 *  - à l'intérieur de chaque règle, retire les déclarations contenant
 *    url(), expression(), -moz-binding, behavior, javascript:, ainsi que
 *    tout `position: fixed` / `position: sticky` (qui pourrait sinon
 *    recouvrir le reste de la page) ;
 *  - préfixe CHAQUE sélecteur par la classe unique du membre (combinateur
 *    descendant), pour qu'une règle ne puisse jamais matcher que des
 *    éléments réellement à l'intérieur de sa propre carte/ligne/fiche.
 *
 * C'est un nettoyeur "au mieux", pas un vrai parseur CSS conforme à la
 * spec — suffisant pour un site communautaire privé, pas pour exposer ça
 * au grand public sans revue supplémentaire.
 */

const BANNED_VALUE_RE = /url\s*\(|expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:/i;

function findMatchingBrace(css: string, openIdx: number): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openIdx; i < css.length; i++) {
    const c = css[i];
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"') {
      inStr = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitTopLevel(text: string, openers: string, closers: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let cur = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      cur += c;
      if (c === "\\") {
        i++;
        if (i < text.length) cur += text[i];
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"') {
      inStr = c;
      cur += c;
      continue;
    }
    if (openers.includes(c)) depth++;
    else if (closers.includes(c)) depth--;
    if (c === sep && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function sanitizeDeclarations(body: string): string[] {
  const decls = splitTopLevel(body, "(", ")", ";");
  const kept: string[] = [];
  for (const raw of decls) {
    const d = raw.trim();
    if (!d) continue;
    if (BANNED_VALUE_RE.test(d)) continue;
    const colonIdx = d.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = d.slice(0, colonIdx).trim().toLowerCase();
    const value = d.slice(colonIdx + 1).trim();
    if (!prop || !value) continue;
    if (prop === "position" && /^(fixed|sticky)/i.test(value)) continue;
    if (prop.startsWith("-moz-binding")) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept;
}

const MAX_DEPTH = 3;
const MAX_RULES = 400;

function scopeAndSanitizeCssInner(raw: string, scopeClass: string, depth: number, ruleBudget: { n: number }): string {
  if (depth > MAX_DEPTH) return "";
  const css = stripComments(raw);
  const scope = `.${scopeClass}`;
  let out = "";
  let i = 0;
  let guard = 0;

  while (i < css.length && guard < 5000 && ruleBudget.n < MAX_RULES) {
    guard++;
    const braceIdx = css.indexOf("{", i);
    if (braceIdx === -1) break;
    const prelude = css.slice(i, braceIdx).trim();
    const closeIdx = findMatchingBrace(css, braceIdx);
    if (closeIdx === -1) break;
    const body = css.slice(braceIdx + 1, closeIdx);

    if (prelude.startsWith("@")) {
      if (/^@media\b/i.test(prelude)) {
        const inner = scopeAndSanitizeCssInner(body, scopeClass, depth + 1, ruleBudget);
        if (inner.trim()) out += `${prelude} {\n${inner}\n}\n`;
      }
      // toute autre règle @ (import, font-face, keyframes, page…) est ignorée en bloc
    } else if (prelude) {
      const selectors = splitTopLevel(prelude, "([", ")]", ",");
      const scoped = selectors.map((s) => `${scope} ${s}`).join(", ");
      const decls = sanitizeDeclarations(body);
      if (scoped && decls.length > 0) {
        out += `${scoped} {\n  ${decls.join(";\n  ")};\n}\n`;
        ruleBudget.n++;
      }
    }

    i = closeIdx + 1;
  }
  return out;
}

/** Nettoie et scope du CSS brut pour qu'il ne puisse s'appliquer qu'à l'intérieur de `.{scopeClass}`. */
export function scopeAndSanitizeCss(raw: string | null | undefined, scopeClass: string): string {
  if (!raw || !raw.trim()) return "";
  try {
    return scopeAndSanitizeCssInner(raw.slice(0, 8000), scopeClass, 0, { n: 0 });
  } catch {
    return "";
  }
}

/** Classe unique et stable à poser sur le conteneur d'un membre pour que son CSS ne s'applique qu'à lui. */
export function profileSkinClass(userId: string): string {
  return `profile-skin-${userId.replace(/[^a-zA-Z0-9-]/g, "")}`;
}
