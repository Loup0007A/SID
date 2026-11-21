/**
 * Tests d'affichage (Lot 95). Fichier identique sur les trois sites ; la
 * liste des pages est dans tests/pages.ts.
 *
 *   SID_TEST_URL=http://localhost:3000 npm run test:affichage
 *
 * Pages de membre : SID_TEST_COOKIE=<valeur du cookie sb-…-auth-token> et
 * SID_TEST_COOKIE_NAME=<son nom>. Sans eux, seules les pages publiques
 * sont vérifiées. Captures dans test-results/.
 *
 * Vérifie : les classes de <html> posées avant React (mémoire locale,
 * cookie, système), aucun texte sous 3:1 (les écarts entre 3 et 4,5 sont
 * listés sans faire échouer), aucune grande surface claire en mode sombre
 * (sauf [data-contraste-libre] : aperçus des styles choisis par les membres),
 * pas de défilement horizontal à 360 px.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { MEMBER_PAGES, PUBLIC_PAGES } from "./pages";

const MODES = {
  clair: { prefs: {}, classes: [] as string[] },
  sombre: { prefs: { theme: "sombre" }, classes: ["sombre"] },
  epure: { prefs: { epure: true }, classes: ["epure", "sans-decor"] },
  "sombre-epure": { prefs: { theme: "sombre", epure: true }, classes: ["sombre", "epure", "sans-decor"] },
};
type Mode = keyof typeof MODES;

const base = new URL(process.env.SID_TEST_URL ?? "http://localhost:3000");
const session = process.env.SID_TEST_COOKIE;
const pages = session ? [...PUBLIC_PAGES, ...MEMBER_PAGES] : PUBLIC_PAGES;

async function prepare(ctx: BrowserContext, prefs: object) {
  if (session) await ctx.addCookies([{ name: process.env.SID_TEST_COOKIE_NAME ?? "sb-auth-token", value: session, domain: base.hostname, path: "/" }]);
  await ctx.addInitScript((p) => {
    try { localStorage.setItem("sid-confort-v1", p); } catch { /* */ }
    document.addEventListener("DOMContentLoaded", () => { (window as unknown as { __classes: string }).__classes = document.documentElement.className; });
  }, JSON.stringify(prefs));
  // Le compte ne doit ni écraser le mode testé ni le recevoir.
  await ctx.route(/display_prefs_(get|set)/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
}

async function open(page: Page, path: string) {
  await page.goto(new URL(path, base).toString(), { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
}

/** Contraste de chaque texte visible et grandes surfaces claires. */
function probe(dark: boolean) {
  const parse = (s: string) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const blend = (t: number[], b: number[]) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const ratio = (a: number[], b: number[]) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const label = (e: Element) => `${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/).slice(0, 3).join(".")}`;
  const bgOf = (el: Element): number[] | null => {
    const layers: number[][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e); const c = parse(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.95) break; }
      if (cs.backgroundImage !== "none" && !(c && c[3] >= 0.95)) {
        if (e === document.body || e === document.documentElement) { const bc = parse(cs.backgroundColor); if (bc && bc[3] > 0) { layers.push([bc[0], bc[1], bc[2], 1]); break; } }
        return null;
      }
    }
    if (!layers.length) return [255, 255, 255, 1];
    let b = layers.pop()!; b = [b[0], b[1], b[2], 1];
    for (let i = layers.length - 1; i >= 0; i--) b = blend(layers[i], b);
    return b;
  };
  const low: { el: string; text: string; ratio: number }[] = [];
  const light: string[] = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg,[aria-hidden='true'],.sr-only,[disabled],[aria-disabled='true'],[data-contraste-libre]")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const cs = getComputedStyle(el);
    // (Une feuille de papier baissée par un filtre « brightness » compte comme sombre.)
    if (dark && r.width * r.height > 40000 && !/brightness/.test(cs.filter)) { const c = parse(cs.backgroundColor); if (c && c[3] > 0.85 && lum(c) > 0.45) light.push(label(el)); }
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent!.trim()).join(" ").trim();
    if (!text) continue;
    let op = 1; for (let x: Element | null = el; x; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
    if (op < 0.35) continue;
    const bg = bgOf(el); const fc = parse(cs.color); if (!bg || !fc) continue;
    fc[3] *= op; const rr = ratio(blend(fc, bg), bg);
    const size = parseFloat(cs.fontSize); const big = size >= 24 || (size >= 18.6 && Number(cs.fontWeight) >= 700);
    if (rr < (big ? 3 : 4.5)) low.push({ el: label(el), text: text.slice(0, 40), ratio: Math.round(rr * 100) / 100 });
  }
  return { low, light };
}

test.describe("classes posées avant React", () => {
  for (const [mode, m] of Object.entries(MODES)) {
    test(`mémoire locale : ${mode}`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: "no-preference" });
      await prepare(ctx, m.prefs);
      const page = await ctx.newPage();
      await open(page, PUBLIC_PAGES[0]);
      const early = await page.evaluate(() => (window as unknown as { __classes: string }).__classes ?? "");
      for (const c of m.classes) expect(early.split(" ")).toContain(c);
      if (!m.classes.includes("sombre")) expect(early.split(" ")).not.toContain("sombre");
      await ctx.close();
    });
  }
  test("cookie sid-confort (appareil neuf)", async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "sid-confort", value: encodeURIComponent(JSON.stringify({ theme: "sombre", text: "large" })), domain: base.hostname, path: "/" }]);
    await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { (window as unknown as { __classes: string }).__classes = document.documentElement.className; }));
    const page = await ctx.newPage();
    await open(page, PUBLIC_PAGES[0]);
    const early = await page.evaluate(() => (window as unknown as { __classes: string }).__classes ?? "");
    expect(early).toContain("sombre");
    expect(early).toContain("texte-grand");
    await ctx.close();
  });
  test("animations selon l'appareil", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    await prepare(ctx, {});
    const page = await ctx.newPage();
    await open(page, PUBLIC_PAGES[0]);
    expect(await page.evaluate(() => document.documentElement.classList.contains("calme"))).toBe(true);
    await ctx.close();
  });
});

test.describe("contraste et surfaces", () => {
  for (const mode of Object.keys(MODES) as Mode[]) {
    for (const path of pages) {
      test(`${mode} ${path}`, async ({ browser }, info) => {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await prepare(ctx, MODES[mode].prefs);
        const page = await ctx.newPage();
        await open(page, path);
        await page.screenshot({ path: info.outputPath(`${mode}.png`) });
        const { low, light } = await page.evaluate(probe, mode.startsWith("sombre"));
        const bad = low.filter((l) => l.ratio < 3);
        const soft = low.filter((l) => l.ratio >= 3);
        if (soft.length) info.annotations.push({ type: "contraste entre 3 et 4,5", description: soft.map((s) => `${s.ratio} ${s.el} « ${s.text} »`).join("\n") });
        expect(bad, "textes sous 3:1").toEqual([]);
        if (mode.startsWith("sombre")) expect(light, "grandes surfaces claires en mode sombre").toEqual([]);
        await ctx.close();
      });
    }
  }
});

test.describe("mobile 360 px", () => {
  for (const path of pages) {
    test(`pas de défilement horizontal ${path}`, async ({ browser }, info) => {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
      await prepare(ctx, {});
      const page = await ctx.newPage();
      await open(page, path);
      await page.screenshot({ path: info.outputPath("360.png"), fullPage: true });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, "largeur qui dépasse l'écran (px)").toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
