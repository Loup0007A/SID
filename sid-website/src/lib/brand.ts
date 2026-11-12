/**
 * Identité du jeu (Lot 77) : nom du RP, des sites, de la monnaie, adresses.
 * Lot 78 : Cartographie et Wiki ouverts ou fermés, adresses des simulations.
 *
 * Les valeurs viennent de app_config (RPC public_config, migration 0094) et
 * se règlent une par une (voir SETUP.md). Le code garde les textes d'origine
 * (« S.I.D. », « zénis », « 12 z »…) : brandify() les remplace au moment de
 * l'affichage. La couche JSX de src/brand/ l'applique à tout le texte rendu
 * par React (contenu, title, aria-label, placeholder, alt), y compris les
 * textes venus de la base (notifications, motifs de mouvements…).
 *
 * L'article devant un nom suit le genre réglé (rp_gender, site_gender…) :
 * « du S.I.D. » → « de l'O.R.D.R.E. », « le Dossier Central » → « les
 * Archives ». Le reste de la phrase (accords) ne change pas.
 *
 * BRAND est un objet du module, le même pour tous les visiteurs : il est posé
 * une fois par page (BrandProvider côté navigateur, getBrand() côté serveur).
 * Le même fichier est copié dans la Cartographie et le Wiki : garder les trois
 * identiques.
 */

/** Genre d'un nom, pour l'article qui le précède : masculin, féminin, pluriel. */
export type Gender = "m" | "f" | "pl";

/** Sites des simulations dont l'adresse se règle (sim_url_<clé>). */
export const SIM_URL_KEYS = ["donjons", "intelligence", "techniques", "arena"] as const;
export type SimUrlKey = (typeof SIM_URL_KEYS)[number];

export type Brand = {
  /** Sigle ou nom court du RP. */
  name: string;
  /** Nom complet (ce que le sigle veut dire). */
  fullName: string;
  /** Nom du site principal. */
  site: string;
  /** Nom du site de la carte. */
  map: string;
  /** Nom du wiki. */
  wiki: string;
  /** Genre de chaque nom (name vaut aussi pour fullName). */
  genders: { name: Gender; site: Gender; map: Gender; wiki: Gender };
  description: string;
  currency: { one: string; many: string; symbol: string };
  contactEmail: string;
  urls: { site: string; map: string; wiki: string };
  /** Rubriques masquées du site principal (clés de src/lib/navigation.ts du Dossier Central). */
  hiddenTabs: string[];
  /** Cartographie et Wiki ouverts aux membres (map_enabled, wiki_enabled). */
  sites: { map: boolean; wiki: boolean };
  /** Adresses des simulations : absente = celle du code, null = pas branchée (« off »). */
  simUrls: Partial<Record<SimUrlKey, string | null>>;
};

export const DEFAULT_BRAND: Brand = {
  name: "S.I.D.",
  fullName: "Système International Dictatorial",
  site: "Dossier Central",
  map: "Cartographie",
  wiki: "Wiki",
  genders: { name: "m", site: "m", map: "f", wiki: "m" },
  description: "Plateforme communautaire du S.I.D.",
  currency: { one: "zéni", many: "zénis", symbol: "z" },
  contactEmail: "",
  urls: { site: "https://sid-quest.vercel.app", map: "https://sid-map.vercel.app", wiki: "https://sid-wiki.vercel.app" },
  hiddenTabs: [],
  sites: { map: true, wiki: true },
  simUrls: {},
};

const isHttpUrl = (v: string) => {
  try {
    return /^https?:$/.test(new URL(v).protocol);
  } catch {
    return false;
  }
};

/** app_config (public_config) → Brand, valeur par défaut pour chaque clé absente ou vide. */
export function brandFromConfig(c: Record<string, unknown> | null | undefined): Brand {
  const s = (k: string, d: string) => {
    const v = c?.[k];
    return typeof v === "string" && v.trim() !== "" ? v.trim() : d;
  };
  let hidden: string[] = [];
  try {
    const raw = c?.tabs_hidden;
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) hidden = arr.filter((x): x is string => typeof x === "string");
  } catch {
    hidden = [];
  }
  const D = DEFAULT_BRAND;
  const on = (k: string) => c?.[k] !== "off";
  const simUrls: Brand["simUrls"] = {};
  for (const k of SIM_URL_KEYS) {
    const v = c?.[`sim_url_${k}`];
    if (typeof v !== "string" || v.trim() === "") continue;
    if (v.trim() === "off") simUrls[k] = null;
    else if (isHttpUrl(v.trim())) simUrls[k] = v.trim(); // adresse invalide : celle du code
  }
  const g = (k: string, d: Gender): Gender => {
    const v = c?.[k];
    return v === "m" || v === "f" || v === "pl" ? v : d;
  };
  return {
    name: s("rp_name", D.name),
    fullName: s("rp_full_name", D.fullName),
    site: s("site_name", D.site),
    map: s("map_name", D.map),
    wiki: s("wiki_name", D.wiki),
    genders: { name: g("rp_gender", D.genders.name), site: g("site_gender", D.genders.site), map: g("map_gender", D.genders.map), wiki: g("wiki_gender", D.genders.wiki) },
    description: s("site_description", D.description),
    currency: { one: s("currency_name", D.currency.one), many: s("currency_plural", D.currency.many), symbol: s("currency_symbol", D.currency.symbol) },
    contactEmail: s("contact_email", D.contactEmail),
    urls: { site: s("url_site", D.urls.site), map: s("url_map", D.urls.map), wiki: s("url_wiki", D.urls.wiki) },
    hiddenTabs: hidden,
    sites: { map: on("map_enabled"), wiki: on("wiki_enabled") },
    simUrls,
  };
}

type Pair = [string | RegExp, string | ((m: string, ...g: string[]) => string)];
type State = Brand & { isDefault: boolean; pairs: Pair[] };

const cap = (w: string) => (w ? w[0].toLocaleUpperCase("fr-FR") + w.slice(1) : w);
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOT_LETTER = "(?<![\\p{L}\\p{N}])";
const WORD_END = "(?![\\p{L}\\p{N}])";
// Articles reconnus devant un nom : « du », « de la », « le », « l' », « au »…
const ART = "([Dd]u|[Dd]e la|[Dd]e l['’]|[Dd]es|[Ll]e|[Ll]a|[Ll]es|[Ll]['’]|[Aa]ux|[Aa]u|[Àà] la|[Àà] l['’])(\\s+|(?<=['’]))";

/** L'article de `to` selon son genre, à la place de `art` (même sorte, même majuscule). */
function article(art: string, sp: string, g: Gender, to: string): string {
  const t = art.toLowerCase().replace("’", "'");
  const kind = /^(du|de la|de l'|des)$/.test(t) ? 0 : /^(au|aux|à la|à l')$/.test(t) ? 2 : 1;
  const ap = art.includes("’") ? "’" : "'";
  sp ||= " "; // « l'S.I.D. » → « les Archives »
  const elide = g !== "pl" && /^[aeiouyhàâäéèêëîïôöùûüœæ]/iu.test(to);
  const out = g === "pl" ? ["des", "les", "aux"][kind] + sp
    : elide ? [`de l${ap}`, `l${ap}`, `à l${ap}`][kind]
    : g === "f" ? ["de la", "la", "à la"][kind] + sp
    : ["du", "le", "au"][kind] + sp;
  return /^\p{Lu}/u.test(art) ? cap(out) : out;
}

function compile(b: Brand): State {
  const D = DEFAULT_BRAND;
  const shortOld = D.name.replace(/\./g, "");
  const shortNew = b.name.replace(/\./g, "");
  // Un nom avec son article (genre), un mot entier, ou un texte tel quel.
  const named = (from: string, to: string, g: Gender, whole = false): Pair => [
    // « Le **S.I.D.** » : le gras du texte des guides peut séparer l'article du nom.
    new RegExp(`${NOT_LETTER}(?:${ART}(\\*\\*)?)?${esc(from)}${whole ? WORD_END : ""}`, "gu"),
    (_m: string, art?: string, sp?: string, bold?: string) => (art ? article(art, sp ?? " ", g, to) + (bold ?? "") : "") + to,
  ];
  const word = (from: string, to: string): Pair => [new RegExp(`${NOT_LETTER}${esc(from)}${WORD_END}`, "gu"), to];
  // Du plus long au plus court : « Indice SID » avant « S.I.D. », « zénis » avant « zéni ».
  const all: [string, string, () => Pair][] = [
    [D.fullName, b.fullName, () => named(D.fullName, b.fullName, b.genders.name)],
    [D.site, b.site, () => named(D.site, b.site, b.genders.site)],
    [D.map, b.map, () => named(D.map, b.map, b.genders.map)],
    // Mot entier seulement : pas « Wikipédia ».
    [D.wiki, b.wiki, () => named(D.wiki, b.wiki, b.genders.wiki, true)],
    [`Indice ${shortOld}`, `Indice ${shortNew}`, () => [`Indice ${shortOld}`, `Indice ${shortNew}`]],
    [D.name, b.name, () => named(D.name, b.name, b.genders.name)],
    // Mots entiers : pas « zénith ».
    [cap(D.currency.many), cap(b.currency.many), () => word(cap(D.currency.many), cap(b.currency.many))],
    [D.currency.many, b.currency.many, () => word(D.currency.many, b.currency.many)],
    [cap(D.currency.one), cap(b.currency.one), () => word(cap(D.currency.one), cap(b.currency.one))],
    [D.currency.one, b.currency.one, () => word(D.currency.one, b.currency.one)],
  ];
  const pairs = all.filter(([a, z]) => a !== z).map(([, , make]) => make());
  const isDefault = pairs.length === 0 && b.currency.symbol === D.currency.symbol;
  return { ...b, isDefault, pairs };
}

export const BRAND: State = compile(DEFAULT_BRAND);

/** Pose l'identité. Accepte un objet incomplet (cache d'une version précédente) : le reste vient des valeurs d'origine. */
export function setBrand(b: Partial<Brand>) {
  const D = DEFAULT_BRAND;
  Object.assign(
    BRAND,
    compile({
      ...D,
      ...b,
      genders: { ...D.genders, ...b.genders },
      currency: { ...D.currency, ...b.currency },
      urls: { ...D.urls, ...b.urls },
      hiddenTabs: Array.isArray(b.hiddenTabs) ? b.hiddenTabs : [],
      sites: { ...D.sites, ...b.sites },
      simUrls: { ...b.simUrls },
    }),
  );
}

const SYMBOL_RE = /(\d)([   ])z(?![\p{L}\p{N}])/gu;

/** Remplace les noms d'origine par ceux de la configuration. Sans effet avec la configuration d'origine. */
export function brandify(s: string): string {
  if (BRAND.isDefault || !s) return s;
  let r = s;
  for (const [from, to] of BRAND.pairs) {
    if (typeof from !== "string") r = r.replace(from, typeof to === "string" ? () => to : to);
    else if (r.includes(from)) r = r.split(from).join(to as string);
  }
  if (BRAND.currency.symbol !== DEFAULT_BRAND.currency.symbol && r.includes("z")) {
    const sym = BRAND.currency.symbol;
    // « 12 z », et « (z) » dans les libellés (« Prix (z) »).
    r = r.replace(SYMBOL_RE, (_m, d: string, sp: string) => `${d}${sp}${sym}`).replace(/\(z\)/g, () => `(${sym})`);
  }
  return r;
}

export const isTabHidden = (key: string) => BRAND.hiddenTabs.includes(key);
