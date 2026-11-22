#!/usr/bin/env node
/**
 * Fichiers communs aux trois sites (Lot 95). Script identique dans les trois
 * dépôts. Compare les copies de ce site à celles des deux autres et sort en
 * erreur si l'une a divergé.
 *
 *   npm run communs                     compare avec GitHub (branche main)
 *   SID_DIRS=../..  npm run communs     compare avec des copies locales
 *   npm run communs -- --copier         recopie les fichiers de CE site dans
 *                                       les copies locales (SID_DIRS requis)
 *
 * SID_DIRS : dossier qui contient les trois dépôts (sid/, sid-wiki/, sid-map/).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITES = {
  main: { repo: "Loup0007A/SID", dir: "sid/sid-website" },
  wiki: { repo: "Loup0007A/SID-wiki", dir: "sid-wiki/sid-wiki" },
  map: { repo: "Loup0007A/SID-map", dir: "sid-map/sid-map" },
};
const ALL = ["main", "wiki", "map"];
const PAGES = ["wiki", "map"];
/** Fichier (depuis src/) → sites qui en ont une copie identique. */
const COMMUNS = {
  "lib/comfortPrefs.ts": ALL,
  "lib/comfortCookie.ts": ALL,
  "components/ComfortSync.tsx": ALL,
  "components/RechercheCommune.tsx": ALL,
  "components/Epingles.tsx": ALL,
  "lib/brand.ts": ALL,
  "lib/glitch.ts": ALL,
  "brand/glitch.ts": ALL,
  "brand/props.ts": ALL,
  "brand/jsx-runtime.ts": ALL,
  "brand/jsx-dev-runtime.ts": ALL,
  "components/BrandProvider.tsx": ALL,
  "components/glitch/GlitchName.tsx": ALL,
  "components/glitch/GlitchSync.tsx": ALL,
  "components/legal/LegalContent.tsx": ALL,
  "components/EventDecor.tsx": PAGES,
  "components/EventDecorLayers.tsx": PAGES,
  "components/ElectionLayer.tsx": PAGES,
  "components/EventHorizons.tsx": PAGES,
  "components/eventArt.tsx": PAGES,
  "lib/supabase/sessionCookie.ts": PAGES,
};
const SCRIPT = "scripts/fichiers-communs.mjs";
const AUTRES = ["tests/affichage.spec.ts", "playwright.config.ts", "en-tetes-securite.js", "scripts/controle-secrets.mjs"];

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const self = Object.keys(SITES).find((k) => here.endsWith(SITES[k].dir.split("/")[1])) ?? "main";
const dirs = process.env.SID_DIRS ? path.resolve(process.env.SID_DIRS) : null;
const copier = process.argv.includes("--copier");
if (copier && !dirs) {
  console.error("--copier demande SID_DIRS (dossier qui contient sid/, sid-wiki/ et sid-map/).");
  process.exit(2);
}

async function lire(site, rel) {
  if (dirs) {
    const f = path.join(dirs, SITES[site].dir, rel);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  }
  const res = await fetch(`https://raw.githubusercontent.com/${SITES[site].repo}/main/${SITES[site].dir.split("/")[1]}/${rel}`);
  return res.ok ? res.text() : null;
}

const jobs = [[SCRIPT, ALL], ...AUTRES.map((f) => [f, ALL]), ...Object.entries(COMMUNS).map(([f, s]) => [`src/${f}`, s])];
let ecarts = 0;
for (const [rel, sites] of jobs) {
  if (!sites.includes(self)) continue;
  const mine = fs.readFileSync(path.join(here, rel), "utf8");
  for (const other of sites.filter((s) => s !== self)) {
    const theirs = await lire(other, rel);
    if (theirs === mine) continue;
    if (copier) {
      const f = path.join(dirs, SITES[other].dir, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, mine);
      console.log(`copié  ${rel} → ${other}`);
      continue;
    }
    ecarts++;
    console.log(`${theirs === null ? "absent" : "différent"}  ${rel}  (${self} ≠ ${other})`);
  }
}
if (!copier) console.log(ecarts ? `${ecarts} écart(s).` : "Fichiers communs identiques.");
process.exit(ecarts ? 1 : 0);
