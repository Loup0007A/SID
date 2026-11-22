/**
 * Nettoie et "scope" le CSS personnalisé d'un membre avant de l'injecter
 * dans la page pour les autres visiteurs.
 *
 * Le serveur refuse déjà (voir set_profile_css) les constructions les plus
 * dangereuses à l'enregistrement, mais la protection qui compte vraiment
 * est ICI : quoi qu'il y ait en base, seul le résultat de cette fonction
 * est injecté dans un <style>, à chaque affichage. Elle :
 *  - retire les commentaires ;
 *  - accepte les déclarations "nues" (sans sélecteur, ex: `border: ...;`
 *    tapées avant toute règle) et les applique directement à la carte du
 *    membre (`.{scopeClass} { ... }`) — c'est ce qu'on attend
 *    intuitivement en tapant du CSS "pour sa carte" sans réfléchir aux
 *    sélecteurs ;
 *  - supprime toute règle @ autre que @media (donc @import, @font-face,
 *    @keyframes, @page, @namespace... disparaissent, avec tout leur bloc) ;
 *  - à l'intérieur de chaque règle, retire les déclarations contenant
 *    url(), expression(), -moz-binding, behavior, javascript:, ainsi que
 *    tout `position: fixed` / `position: sticky` (qui pourrait sinon
 *    recouvrir le reste de la page) ;
 *  - met les sélecteurs de CLASSE en minuscules (`.RANK-CARD-LETTER` ->
 *    `.rank-card-letter`) : toutes les classes de ce site sont en
 *    minuscules, donc c'est presque toujours une faute de frappe plutôt
 *    qu'une intention — sans ça, une règle qui ne matche jamais rien
 *    donne l'impression que "le CSS ne marche pas du tout" ;
 *  - préfixe CHAQUE sélecteur par la classe unique du membre (combinateur
 *    descendant), pour qu'une règle ne puisse jamais matcher que des
 *    éléments réellement à l'intérieur de sa propre carte/ligne/fiche.
 *
 * C'est un nettoyeur "au mieux", pas un vrai parseur CSS conforme à la
 * spec — suffisant pour un site communautaire privé, pas pour exposer ça
 * au grand public sans revue supplémentaire.
 *
 * Audit de sécurité (Lot 99) :
 *  - les échappements CSS (`u\72l(`) ne servent plus à contourner la liste :
 *    une déclaration avec un « \ » hors des guillemets est retirée, et la
 *    liste est vérifiée sur le texte décodé ;
 *  - image-set(), image(), element(), src() sont refusés comme url() ;
 *  - une déclaration qui contient { ou } (règle imbriquée) est retirée ;
 *  - un sélecteur qui commence par ~ ou + (frères de la carte, donc hors
 *    de la carte), qui contient &, @, ; ou des parenthèses déséquilibrées
 *    est retiré ;
 *  - sur la carte elle-même : ni position, ni décalage, ni transformation,
 *    ni z-index, ni marge négative ; et `contain: paint` est imposé, pour
 *    que rien de ce qu'elle contient ne déborde sur le reste de la page.
 */

const BANNED_VALUE_RE = /url\s*\(|image-set\s*\(|(^|[^a-z-])image\s*\(|element\s*\(|(^|[^a-z-])src\s*\(|expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:/i;
const PROP_RE = /^(--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/;
/** Propriétés refusées sur la carte elle-même (elle pourrait recouvrir la page). */
const ROOT_BANNED_PROPS = /^(position|inset|top|left|right|bottom|transform|translate|scale|rotate|zoom|z-index|contain|overflow|overflow-x|overflow-y)$/;

/** Texte sans ses chaînes entre guillemets. */
function horsTextes(s: string): string {
  return s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "");
}

/** Décode les échappements CSS (\72, \l) pour vérifier ce que le navigateur lira. */
function decode(s: string): string {
  return s
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h: string) => {
      const n = parseInt(h, 16);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/\\(.)/g, "$1");
}

function selecteurSur(sel: string): boolean {
  const t = sel.trim();
  if (!t || /^[~+]/.test(t) || /[&@;{}\\]/.test(t)) return false;
  let p = 0;
  let b = 0;
  for (const c of t) {
    if (c === "(") p++;
    else if (c === ")") p--;
    else if (c === "[") b++;
    else if (c === "]") b--;
    if (p < 0 || b < 0) return false;
  }
  return p === 0 && b === 0;
}

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

/** Découpe `text` sur `sep` en ignorant les séparateurs à l'intérieur de guillemets ou entre `openers`/`closers`. */
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

/** Index du DERNIER `;` de premier niveau (hors guillemets/parenthèses/crochets), ou -1. */
function lastTopLevelSemicolon(text: string): number {
  let depth = 0;
  let inStr: string | null = null;
  let last = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
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
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (c === ";" && depth === 0) last = i;
  }
  return last;
}

function sanitizeDeclarations(body: string, racine = false): string[] {
  const decls = splitTopLevel(body, "(", ")", ";");
  const kept: string[] = [];
  for (const raw of decls) {
    const d = raw.trim();
    if (!d) continue;
    const brut = horsTextes(d);
    if (/[{}\\]/.test(brut)) continue;
    if (BANNED_VALUE_RE.test(d) || BANNED_VALUE_RE.test(decode(d))) continue;
    const colonIdx = d.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = d.slice(0, colonIdx).trim().toLowerCase();
    const value = d.slice(colonIdx + 1).trim();
    if (!prop || !value || !PROP_RE.test(prop)) continue;
    if (prop === "position" && /^(fixed|sticky)/i.test(value)) continue;
    if (prop.startsWith("-moz-binding")) continue;
    if (racine && (ROOT_BANNED_PROPS.test(prop) || (/^margin/.test(prop) && /-/.test(value)))) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept;
}

/** Met en minuscules les sélecteurs de classe (`.Foo` -> `.foo`) ; laisse le reste du sélecteur intact. */
function lowercaseClassTokens(selector: string): string {
  return selector.replace(/\.[A-Za-z0-9_-]+/g, (m) => m.toLowerCase());
}

const MAX_DEPTH = 3;
const MAX_RULES = 400;

interface Budget {
  n: number;
}

/** Sanitize un bloc de déclarations "nues" (sans sélecteur) et l'émet comme règle appliquée à la racine du scope. */
function emitLooseDeclarations(fragment: string, scope: string, budget: Budget): string {
  if (budget.n >= MAX_RULES) return "";
  const decls = sanitizeDeclarations(fragment, true);
  if (decls.length === 0) return "";
  budget.n++;
  return `${scope} {\n  ${decls.join(";\n  ")};\n}\n`;
}

function scopeAndSanitizeCssInner(raw: string, scopeClass: string, depth: number, budget: Budget): string {
  if (depth > MAX_DEPTH) return "";
  const css = stripComments(raw);
  const scope = `.${scopeClass}`;
  let out = "";
  let i = 0;
  let guard = 0;

  while (i < css.length && guard < 5000 && budget.n < MAX_RULES) {
    guard++;
    const braceIdx = css.indexOf("{", i);
    if (braceIdx === -1) break;
    let prelude = css.slice(i, braceIdx).trim();
    const closeIdx = findMatchingBrace(css, braceIdx);
    if (closeIdx === -1) break;
    const body = css.slice(braceIdx + 1, closeIdx);

    // Déclarations "nues" tapées avant un sélecteur (ex: l'utilisateur a
    // écrit `border: ...; background: ...;` avant sa première vraie
    // règle) : tout ce qui précède le DERNIER `;` de premier niveau n'est
    // pas un sélecteur valide, on l'extrait et on l'applique à la racine.
    const semiIdx = lastTopLevelSemicolon(prelude);
    if (semiIdx !== -1) {
      out += emitLooseDeclarations(prelude.slice(0, semiIdx + 1), scope, budget);
      prelude = prelude.slice(semiIdx + 1).trim();
    }

    if (prelude.startsWith("@")) {
      if (/^@media\b/i.test(prelude)) {
        const inner = scopeAndSanitizeCssInner(body, scopeClass, depth + 1, budget);
        if (inner.trim()) out += `${prelude} {\n${inner}\n}\n`;
      }
      // toute autre règle @ (import, font-face, keyframes, page…) est ignorée en bloc
    } else if (prelude) {
      const selectors = splitTopLevel(prelude, "([", ")]", ",").filter(selecteurSur);
      const scoped = selectors.map((s) => `${scope} ${lowercaseClassTokens(s)}`).join(", ");
      const decls = sanitizeDeclarations(body);
      if (scoped && decls.length > 0 && budget.n < MAX_RULES) {
        out += `${scoped} {\n  ${decls.join(";\n  ")};\n}\n`;
        budget.n++;
      }
    } else if (body.trim()) {
      // Prelude vide (rien entre la fin de la règle précédente et cette
      // accolade) mais un corps non vide : traite le corps lui-même comme
      // des déclarations nues plutôt que de le perdre silencieusement.
      out += emitLooseDeclarations(body, scope, budget);
    }

    i = closeIdx + 1;
  }

  // Reste éventuel après la dernière accolade (ou aucune accolade du
  // tout) : si ça ressemble à des déclarations, on ne les perd pas.
  const tail = css.slice(i).trim();
  if (tail && !tail.startsWith("@")) {
    out += emitLooseDeclarations(tail.endsWith(";") ? tail : `${tail};`, scope, budget);
  }

  return out;
}

/** Nettoie et scope du CSS brut pour qu'il ne puisse s'appliquer qu'à l'intérieur de `.{scopeClass}`. */
export function scopeAndSanitizeCss(raw: string | null | undefined, scopeClass: string): string {
  if (!raw || !raw.trim()) return "";
  try {
    const out = scopeAndSanitizeCssInner(raw.slice(0, 8000), scopeClass, 0, { n: 0 });
    // La carte garde tout son contenu chez elle (Lot 99).
    return out ? `${out}.${scopeClass} { contain: paint !important; }\n` : "";
  } catch {
    return "";
  }
}

/** Classe unique et stable à poser sur le conteneur d'un membre pour que son CSS ne s'applique qu'à lui. */
export function profileSkinClass(userId: string): string {
  return `profile-skin-${userId.replace(/[^a-zA-Z0-9-]/g, "")}`;
}
