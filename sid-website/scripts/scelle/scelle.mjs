#!/usr/bin/env node
/**
 * Sceau des titres secrets.
 *
 * Le code qui révèle comment obtenir les titres est publié BROUILLÉ :
 *   - composants côté navigateur  → src/components/sceaux/*.js (obfusqués)
 *   - « comment il a été obtenu » → src/lib/cachet.js (obfusqué)
 *   - parties de la migration 0061 → blocs SQL qui se déchiffrent eux-mêmes
 *     au moment où la migration est lancée (le résultat en base est identique).
 *
 * Les sources lisibles ne sont pas publiées : elles sont chiffrées dans
 * scripts/scelle/coffre.bin (AES-256-GCM, clé dérivée d'une phrase secrète).
 *
 *   SCELLE_CLE="…" node scripts/scelle/scelle.mjs ouvrir    → .scelle/ (lisible, ignoré par git)
 *   SCELLE_CLE="…" node scripts/scelle/scelle.mjs sceller   → coffre.bin + fichiers brouillés
 *   node scripts/scelle/scelle.mjs verifier                 → les blocs SQL redonnent bien .scelle/sql
 *
 * Prérequis : `npm install` dans scripts/scelle (esbuild, javascript-obfuscator).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const ICI = dirname(fileURLToPath(import.meta.url));
const SITE = join(ICI, "..", "..");
const LISIBLE = join(SITE, ".scelle");
const COFFRE = join(ICI, "coffre.bin");

// Ce qui est produit à partir de .scelle/ (source → fichier publié).
const COMPOSANTS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"].map((n) => [`composants/${n}.tsx`, `src/components/sceaux/${n}.js`]);
const CACHET = ["cachet.json", "src/lib/cachet.js"];
const SQL = [
  ["sql/0061_titres_trolls.sql", "supabase/migrations/0061_titres_trolls.sql"],
  ["sql/0065_titres_evenement.sql", "supabase/migrations/0065_titres_evenement.sql"],
  ["sql/0066_farces_remise_a_niveau.sql", "supabase/migrations/0066_farces_remise_a_niveau.sql"],
  ["sql/0067_evenements.sql", "supabase/migrations/0067_evenements.sql"],
];

function cle() {
  const k = process.env.SCELLE_CLE;
  if (!k) {
    console.error("Phrase secrète manquante : SCELLE_CLE=\"…\" node scripts/scelle/scelle.mjs …");
    process.exit(1);
  }
  return k;
}

function lister(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? lister(join(dir, e.name), base) : [relative(base, join(dir, e.name))]
  );
}

// ---------------------------------------------------------------- coffre
function fermerCoffre(phrase) {
  const fichiers = Object.fromEntries(lister(LISIBLE).sort().map((f) => [f, readFileSync(join(LISIBLE, f), "utf8")]));
  const clair = gzipSync(Buffer.from(JSON.stringify(fichiers)));
  const sel = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", scryptSync(phrase, sel, 32), iv);
  const chiffre = Buffer.concat([c.update(clair), c.final()]);
  writeFileSync(COFFRE, Buffer.concat([Buffer.from("SCEL1"), sel, iv, c.getAuthTag(), chiffre]));
  return Object.keys(fichiers).length;
}

function ouvrirCoffre(phrase) {
  const b = readFileSync(COFFRE);
  if (b.subarray(0, 5).toString() !== "SCEL1") throw new Error("coffre illisible");
  const sel = b.subarray(5, 21), iv = b.subarray(21, 33), tag = b.subarray(33, 49);
  const d = createDecipheriv("aes-256-gcm", scryptSync(phrase, sel, 32), iv);
  d.setAuthTag(tag);
  let clair;
  try {
    clair = Buffer.concat([d.update(b.subarray(49)), d.final()]);
  } catch {
    console.error("Mauvaise phrase secrète.");
    process.exit(1);
  }
  const fichiers = JSON.parse(gunzipSync(clair).toString());
  for (const [f, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(LISIBLE, f)), { recursive: true });
    writeFileSync(join(LISIBLE, f), contenu);
  }
  return Object.keys(fichiers).length;
}

// ---------------------------------------------------------------- SQL
// Flux de clé : md5(graine || numéro de bloc de 16 octets), en XOR.
function xorFlux(octets, graine) {
  const out = Buffer.alloc(octets.length);
  for (let i = 0; i < octets.length; i += 16) {
    const k = createHash("md5").update(graine + String(i / 16)).digest();
    for (let j = 0; j < 16 && i + j < octets.length; j++) out[i + j] = octets[i + j] ^ k[j];
  }
  return out;
}

function blocScelle(sqlClair, graine) {
  const b64 = xorFlux(Buffer.from(sqlClair, "utf8"), graine).toString("base64").match(/.{1,96}/g).join("\n");
  return [
    "do $q$",
    "declare",
    `  c text := '${graine}';`,
    `  b bytea := decode('`,
    b64,
    `', 'base64');`,
    "begin",
    "  execute (",
    "    select convert_from(string_agg(set_byte('\\x00'::bytea, 0,",
    "             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')",
    "    from generate_series(0, length(b) - 1) i);",
    "end",
    "$q$;",
  ].join("\n");
}

function scellerSql(texte, nomFichier) {
  let n = 0;
  return texte.replace(/^-- @scelle\n([\s\S]*?)\n-- @\/scelle$/gm, (_, corps) => {
    n += 1;
    const graine = createHash("sha256").update(nomFichier + ":" + n + ":" + corps).digest("hex").slice(0, 24);
    return `-- ▓▓ Partie scellée n° ${n} ▓▓\n${blocScelle(corps, graine)}`;
  });
}

function relireSql(texte) {
  const blocs = [];
  const re = /c text := '([0-9a-f]+)';\n  b bytea := decode\('\n([\s\S]*?)\n', 'base64'\);/g;
  let m;
  while ((m = re.exec(texte))) blocs.push(xorFlux(Buffer.from(m[2].replace(/\n/g, ""), "base64"), m[1]).toString("utf8"));
  return blocs;
}

// ---------------------------------------------------------------- JS
async function brouiller(source, graine) {
  const { transform } = await import("esbuild");
  const JavaScriptObfuscator = (await import("javascript-obfuscator")).default;
  const client = /^\s*(\/\/[^\n]*\n)*\s*["']use client["']/.test(source);
  const { code } = await transform(source, { loader: source.includes("<") ? "tsx" : "ts", jsx: "automatic", format: "esm", target: "es2020" });
  const sansDirective = code.replace(/^\s*["']use client["'];?\s*/, "");
  const sortie = JavaScriptObfuscator.obfuscate(sansDirective, {
    seed: graine,
    sourceType: "module",
    target: "browser",
    compact: true,
    simplify: true,
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    selfDefending: false,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    numbersToExpressions: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayThreshold: 1,
    // base64 plutôt que rc4 : tout aussi illisible à l'œil, mais le décodage
    // au chargement est ~10 fois plus rapide (rc4 coûtait jusqu'à ~100 ms
    // par composant sur un téléphone).
    stringArrayEncoding: ["base64"],
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();
  return `${client ? '"use client";\n' : ""}// Code scellé : voir scripts/scelle/scelle.mjs.\n/* eslint-disable */\n// @ts-nocheck\n${sortie}\n`;
}

// ---------------------------------------------------------------- Tailwind
// Tailwind ne génère que les classes qu'il lit dans src/ : celles des
// composants brouillés seraient perdues (fond transparent, positions…). On
// les recopie, triées, dans un fichier qu'il lit.
function classesUtilisees(sources) {
  const out = new Set();
  const prendre = (txt) =>
    txt
      .replace(/\$\{[^}]*\}/g, " ")
      .split(/\s+/)
      .filter((t) => /^[!-]?[a-z0-9[][a-z0-9:\-\[\]#/.%_(),']*$/i.test(t) && t.length > 1)
      .forEach((t) => out.add(t));
  for (const src of sources) {
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/g)) {
      if (m[1] != null) prendre(m[1]);
      else if (m[2] != null) prendre(m[2]);
      else for (const lit of (m[3] ?? "").matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) prendre(lit[1] ?? lit[2] ?? lit[3] ?? "");
    }
  }
  return [...out].sort();
}

// ---------------------------------------------------------------- commandes
const cmd = process.argv[2];
if (cmd === "ouvrir") {
  console.log(`${ouvrirCoffre(cle())} fichiers déchiffrés dans .scelle/`);
} else if (cmd === "sceller") {
  const phrase = cle();
  if (!existsSync(LISIBLE)) throw new Error(".scelle/ absent : lance d'abord « ouvrir »");
  const sources = [];
  for (const [src, dst] of COMPOSANTS) {
    mkdirSync(dirname(join(SITE, dst)), { recursive: true });
    const code = readFileSync(join(LISIBLE, src), "utf8");
    sources.push(code);
    writeFileSync(join(SITE, dst), await brouiller(code, dst));
    console.log("brouillé :", dst);
  }
  const classes = classesUtilisees(sources);
  writeFileSync(
    join(SITE, "src/components/sceaux/classes.ts"),
    `// Classes Tailwind des composants scellés (généré par scripts/scelle/scelle.mjs) :\n// sans ce fichier, Tailwind ne les voit pas dans le code brouillé.\nexport const CLASSES_SCELLEES = ${JSON.stringify(classes.join(" "))};\n`
  );
  console.log(`classes Tailwind : ${classes.length}`);
  const cachet = JSON.parse(readFileSync(join(LISIBLE, CACHET[0]), "utf8"));
  writeFileSync(
    join(SITE, CACHET[1]),
    await brouiller(
      `const T = ${JSON.stringify(cachet.comment)};\nconst S = ${JSON.stringify(cachet.sources)};\n` +
        `export function commentObtenu(id) {\n  return T[id] ?? "";\n}\n` +
        `export function sourceObtention(cle) {\n  return cle == null ? "" : S[cle] ?? cle;\n}\n`,
      CACHET[1]
    )
  );
  console.log("brouillé :", CACHET[1]);
  for (const [src, dst] of SQL) {
    writeFileSync(join(SITE, dst), scellerSql(readFileSync(join(LISIBLE, src), "utf8"), dst));
    console.log("scellé :", dst);
  }
  console.log(`coffre : ${fermerCoffre(phrase)} fichiers chiffrés dans scripts/scelle/coffre.bin`);
} else if (cmd === "verifier") {
  let ok = true;
  for (const [src, dst] of SQL) {
    const lisible = readFileSync(join(LISIBLE, src), "utf8");
    const attendus = [...lisible.matchAll(/^-- @scelle\n([\s\S]*?)\n-- @\/scelle$/gm)].map((m) => m[1]);
    const relus = relireSql(readFileSync(join(SITE, dst), "utf8"));
    const same = attendus.length === relus.length && attendus.every((a, i) => a === relus[i]);
    console.log(`${dst} : ${relus.length} partie(s) scellée(s), ${same ? "identiques à la source" : "DIFFÉRENTES"}`);
    ok &&= same;
  }
  process.exit(ok ? 0 : 1);
} else {
  console.log("Usage : node scripts/scelle/scelle.mjs ouvrir | sceller | verifier");
}
