#!/usr/bin/env node
/**
 * Contrôle des secrets (Lot 96). Script identique dans les trois dépôts.
 * Le code est public : rien de secret ne doit être dans l'historique git ni
 * dans le JavaScript envoyé aux navigateurs (.next/static).
 *
 *   npm run secrets                       historique git + build s'il existe
 *   SCELLE_CLE=… npm run secrets          cherche aussi la phrase du sceau des
 *                                         titres (jamais écrite dans le dépôt)
 *
 * Cherche :
 *  - les clés Supabase « service_role » (jeton JWT dont le rôle n'est pas anon),
 *  - les clés privées (PEM), la clé privée VAPID des notifications push,
 *  - les mots de passe dans une adresse postgres://, les clés GitHub, AWS,
 *    Google, Stripe, Slack, Resend,
 *  - les fichiers .env (sauf .env.example) et le dossier .scelle/ (sources
 *    lisibles des titres) ajoutés un jour à git,
 *  - la phrase du sceau (SCELLE_CLE), telle quelle ou en base64,
 *  - dans le build : la valeur des variables secrètes présentes dans
 *    l'environnement (SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY…).
 * Sort en erreur (code 1) au premier problème ; n'affiche jamais un secret
 * en entier.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: here, maxBuffer: 1 << 30 }).toString();
const masque = (s) => (s.length <= 10 ? "…" : `${s.slice(0, 6)}…${s.slice(-3)} (${s.length} caractères)`);

const MOTIFS = [
  ["clé privée PEM", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["clé VAPID privée", /VAPID_PRIVATE_KEY\s*[=:]\s*["']?([A-Za-z0-9_-]{40,})/g],
  ["clé service_role nommée", /SERVICE_ROLE_KEY\s*[=:]\s*["']?(ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g],
  ["mot de passe dans une adresse postgres", /postgres(?:ql)?:\/\/[^:\s/'"]+:([^@\s'"]{6,})@(?!localhost|127\.0\.0\.1|\.\.\.|xxx)/g],
  ["jeton GitHub", /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/g],
  ["clé AWS", /\bAKIA[0-9A-Z]{16}\b/g],
  ["clé Google", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["clé Stripe", /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g],
  ["jeton Slack", /\bxox[abpr]-[A-Za-z0-9-]{20,}\b/g],
  ["clé Resend", /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}\b/g],
];
// Jetons JWT : seul le rôle « anon » est public.
const JWT = /\bey[A-Za-z0-9_-]{10,}\.(ey[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{20,}\b/g;

const problemes = [];
function examiner(texte, ou, phrases) {
  for (const [nom, re] of MOTIFS) {
    for (const m of texte.matchAll(re)) problemes.push(`${nom} : ${masque(m[1] ?? m[0])} — ${ou}`);
  }
  for (const m of texte.matchAll(JWT)) {
    try {
      const role = JSON.parse(Buffer.from(m[1], "base64url").toString()).role;
      if (role && role !== "anon" && role !== "authenticated") problemes.push(`jeton JWT de rôle « ${role} » : ${masque(m[0])} — ${ou}`);
    } catch {
      /* pas un vrai JWT */
    }
  }
  for (const [nom, p] of phrases) if (p && texte.includes(p)) problemes.push(`${nom} trouvée — ${ou}`);
}

const cle = process.env.SCELLE_CLE?.trim();
const phrases = cle
  ? [
      ["phrase du sceau", cle],
      ["phrase du sceau (base64)", Buffer.from(cle).toString("base64").replace(/=+$/, "")],
      ["phrase du sceau (base64url)", Buffer.from(cle).toString("base64url")],
    ]
  : [];

// 1. Historique git : chaque version de chaque fichier, toutes branches.
let commits = 0;
let dansGit = false;
try {
  dansGit = git("rev-parse", "--is-inside-work-tree").trim() === "true";
} catch {
  /* pas un dépôt git (copie sans historique) */
}
if (dansGit) {
  // Tout le dépôt (le site est dans un sous-dossier), toutes les branches.
  commits = Number(git("rev-list", "--all", "--count").trim());
  const journal = git("log", "--all", "-p", "--no-color", "--no-ext-diff", "--format=@@COMMIT %h");
  let commit = "?";
  let fichier = "?";
  let bloc = [];
  const vider = () => {
    if (bloc.length) examiner(bloc.join("\n"), `commit ${commit}, ${fichier}`, phrases);
    bloc = [];
  };
  for (const ligne of journal.split("\n")) {
    if (ligne.startsWith("@@COMMIT ")) { vider(); commit = ligne.slice(9); continue; }
    if (ligne.startsWith("+++ b/")) { vider(); fichier = ligne.slice(6); continue; }
    if (ligne.startsWith("+") && !ligne.startsWith("+++")) bloc.push(ligne.slice(1));
  }
  vider();
  // Messages de commit aussi.
  examiner(git("log", "--all", "--format=%h %B"), "messages de commit", phrases);
  // Fichiers qui ne doivent jamais entrer dans git.
  const noms = new Set(git("log", "--all", "--name-only", "--format=").split("\n").filter(Boolean));
  for (const n of noms) {
    const base = path.basename(n);
    if (/^\.env(\..+)?$/.test(base) && !/\.(example|exemple|sample)$/.test(base)) problemes.push(`fichier ${n} présent dans l'historique git`);
    if (/(^|\/)\.scelle\//.test(n)) problemes.push(`source lisible des titres ${n} présente dans l'historique git`);
  }
}

// 2. Build : le JavaScript et le CSS envoyés aux navigateurs.
const statique = path.join(here, ".next", "static");
let fichiersBuild = 0;
if (fs.existsSync(statique)) {
  const secretsEnv = ["SUPABASE_SERVICE_ROLE_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET", "SCELLE_CLE", "DATABASE_URL", "RESEND_API_KEY"]
    .map((k) => [`valeur de ${k}`, process.env[k]?.trim()])
    .filter(([, v]) => v && v.length >= 12);
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) parcourir(f);
      else if (/\.(js|css|json|map|html|txt)$/.test(e.name)) {
        fichiersBuild++;
        examiner(fs.readFileSync(f, "utf8"), `build ${path.relative(here, f)}`, [...phrases, ...secretsEnv]);
      }
    }
  };
  parcourir(statique);
}

console.log(`Historique : ${commits} commits lus. Build : ${fichiersBuild ? `${fichiersBuild} fichiers lus` : "absent (lancer npm run build pour le contrôler)"}.`);
if (!cle) console.log("Phrase du sceau non cherchée (SCELLE_CLE absent).");
if (problemes.length) {
  console.log(`${problemes.length} problème(s) :`);
  for (const p of [...new Set(problemes)]) console.log(`  ${p}`);
  process.exit(1);
}
console.log("Aucun secret trouvé.");
