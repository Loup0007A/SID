"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { can } from "@/lib/permissions";
import { visibleEntries } from "@/lib/navigation";
import type { PermissionKey } from "@/types/database";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import { useTuto } from "@/components/tuto/TutoProvider";
import { announceDeepLink } from "@/lib/deeplink";

/**
 * Palette de recherche (Lot 59) : Ctrl+K (ou ⌘K, ou « / ») depuis n'importe
 * quelle page du Dossier Central. On y tape quelques lettres pour aller à une
 * page, au dossier d'un membre, à une quête, à un objet du Comptoir, ou pour
 * lancer une action. Les accents et l'ordre des lettres comptent peu.
 */

type Kind = "page" | "action" | "membre" | "quete" | "objet";
type Item = {
  id: string;
  kind: Kind;
  label: string;
  hint?: string;
  icon: IconName;
  /** Mots en plus pour la recherche (description, rang…). */
  keywords?: string;
  href?: string;
  external?: boolean;
  run?: () => void;
  avatar?: string | null;
};

const GROUPS: { kind: Kind; label: string; max: number }[] = [
  { kind: "page", label: "Pages", max: 6 },
  { kind: "action", label: "Actions", max: 4 },
  { kind: "membre", label: "Membres", max: 5 },
  { kind: "quete", label: "Quêtes", max: 5 },
  { kind: "objet", label: "Comptoir", max: 5 },
];

const RECENT_KEY = "sid-palette-recent";
const OPEN_EVENT = "sid:palette-open";

/** Ouvre la palette depuis n'importe où (bouton, raccourci, tuto). */
export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Note de ressemblance (0 = rien). Début de mot > dans le mot > lettres dans l'ordre. */
function score(query: string, item: Item): number {
  const q = norm(query.trim());
  if (!q) return 1;
  const label = norm(item.label);
  const extra = norm(`${item.hint ?? ""} ${item.keywords ?? ""}`);
  let best = 0;
  for (const word of q.split(/\s+/)) {
    let s = 0;
    if (label.startsWith(word)) s = 100;
    else if (new RegExp(`(^|[\\s'’.-])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(label)) s = 80;
    else if (label.includes(word)) s = 60;
    else if (extra.includes(word)) s = 35;
    else {
      // Lettres dans l'ordre, la première au début d'un mot (« mdos » trouve « Mon dossier »).
      const starts = label.split(/[\s'’.-]+/).map((w) => w[0]);
      let i = 0;
      for (const c of label) if (c === word[i]) i++;
      s = i === word.length && word.length >= 2 && starts.includes(word[0]) ? 20 : 0;
    }
    if (s === 0) return 0; // chaque mot tapé doit trouver quelque chose
    best += s;
  }
  return best - label.length * 0.05;
}

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
}

const z = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} z`;

export function CommandPalette({ perms, onLogout }: { perms: Set<PermissionKey>; onLogout: () => void }) {
  const router = useRouter();
  const tuto = useTuto();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data, setData] = useState<Item[] | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Raccourcis : Ctrl+K / ⌘K partout, « / » hors d'un champ de saisie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // À l'ouverture : focus dans le champ, données chargées une fois par visite.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    setRecent(readRecent());
    requestAnimationFrame(() => inputRef.current?.focus());
    if (data) return;
    const sb = createClient();
    Promise.allSettled([
      sb.from("profiles").select("id, nickname, member_rank, avatar_url").eq("status", "active").order("nickname").limit(500),
      sb.from("quests").select("id, title, reward, difficulty, status").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(200),
      sb.from("shop_items").select("id, name, price, sale_price, sale_ends_at, stock").eq("is_active", true).is("hidden_at", null).order("created_at", { ascending: false }).limit(300),
    ]).then(([m, q, s]) => {
      const out: Item[] = [];
      if (m.status === "fulfilled")
        for (const p of (m.value.data ?? []) as { id: string; nickname: string; member_rank: string; avatar_url: string | null }[])
          out.push({ id: `m:${p.id}`, kind: "membre", label: p.nickname, hint: `Rang ${p.member_rank}`, icon: "profile", href: `/dashboard/profile/${p.id}`, avatar: p.avatar_url });
      if (q.status === "fulfilled")
        for (const x of (q.value.data ?? []) as { id: string; title: string; reward: number; difficulty: string; status: string }[])
          out.push({
            id: `q:${x.id}`,
            kind: "quete",
            label: x.title,
            hint: `Rang ${x.difficulty} · ${z(Number(x.reward))}${x.status === "in_progress" ? " · en cours" : ""}`,
            icon: "scroll",
            href: `/dashboard/quests?quete=${x.id}`,
          });
      if (s.status === "fulfilled")
        for (const it of (s.value.data ?? []) as { id: string; name: string; price: number; sale_price: number | null; sale_ends_at: string | null; stock: number | null }[]) {
          const promo = it.sale_price != null && (!it.sale_ends_at || new Date(it.sale_ends_at) > new Date());
          out.push({
            id: `o:${it.id}`,
            kind: "objet",
            label: it.name,
            hint: `${z(Number(promo ? it.sale_price : it.price))}${promo ? " · promo" : ""}${it.stock === 0 ? " · épuisé" : ""}`,
            icon: "cart",
            href: `/dashboard/shop?objet=${it.id}`,
          });
        }
      setData(out);
    });
  }, [open, data]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => returnFocus.current?.focus?.());
  }, []);

  const staticItems = useMemo<Item[]>(() => {
    const pages: Item[] = [
      { id: "p:home", kind: "page", label: "Accueil", hint: "Tableau de bord", icon: "home", href: "/dashboard" },
      ...visibleEntries((...anyOf) => can(perms, ...anyOf)).map(
        (e): Item => ({ id: `p:${e.key}`, kind: "page", label: e.label, hint: e.description, icon: e.icon, href: e.href }),
      ),
      { id: "p:carto", kind: "page", label: "Cartographie", hint: "La carte du monde (autre site)", icon: "compass", href: "https://sid-map.vercel.app/carte", external: true, keywords: "carte monde atlas" },
      { id: "p:wiki", kind: "page", label: "Wiki du S.I.D.", hint: "Lieux, armes, mobs, objets (autre site)", icon: "book", href: "https://sid-wiki.vercel.app", external: true, keywords: "codex fiches" },
    ];
    const actions: Item[] = [];
    if (tuto?.data) {
      actions.push({ id: "a:tour", kind: "action", label: "Rejouer la visite guidée", hint: "Le tour du Dossier Central", icon: "compass", keywords: "tuto aide tutoriel", run: () => tuto.startTour() });
      actions.push({ id: "a:brief", kind: "action", label: "Rouvrir le dossier d'intégration", hint: "Les premiers pas", icon: "idcard", keywords: "tuto aide", run: () => tuto.openBriefing() });
      const off = !!tuto.data.tips_disabled;
      actions.push({ id: "a:tips", kind: "action", label: off ? "Réactiver les astuces de page" : "Masquer les astuces de page", icon: "bulb", keywords: "aide conseils", run: () => tuto.setTipsDisabled(!off) });
    }
    actions.push({ id: "a:logout", kind: "action", label: "Se déconnecter", icon: "power", keywords: "deconnexion quitter", run: onLogout });
    return [...pages, ...actions];
  }, [perms, tuto, onLogout]);

  const all = useMemo(() => [...staticItems, ...(data ?? [])], [staticItems, data]);

  // Résultats regroupés ; sans recherche : les récents puis les pages.
  const sections = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const byId = new Map(all.map((i) => [i.id, i]));
      const rec = recent.map((id) => byId.get(id)).filter(Boolean) as Item[];
      const out: { label: string; items: Item[] }[] = [];
      if (rec.length) out.push({ label: "Récemment", items: rec });
      out.push({ label: "Pages", items: staticItems.filter((i) => i.kind === "page" && !recent.includes(i.id)).slice(0, 8) });
      return out;
    }
    // Le groupe qui contient la meilleure réponse passe en premier : Entrée
    // ouvre ce qui ressemble le plus à ce qu'on a tapé.
    return GROUPS.map((g, order) => {
      const scored = all
        .filter((i) => i.kind === g.kind)
        .map((i) => [i, score(q, i)] as const)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, g.max);
      return { label: g.label, items: scored.map(([i]) => i), best: (scored[0]?.[1] ?? 0) - order * 0.01 };
    })
      .filter((s) => s.items.length > 0)
      .sort((a, b) => b.best - a.best);
  }, [query, all, recent, staticItems]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  useEffect(() => setActive(0), [query]);

  // Garde l'élément actif visible pendant qu'on descend au clavier.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: Item | undefined) {
    if (!item) return;
    pushRecent(item.id);
    setOpen(false);
    if (item.run) return item.run();
    if (!item.href) return;
    if (item.external) window.open(item.href, "_blank", "noopener");
    else {
      router.push(item.href, { scroll: false });
      // Page déjà ouverte (ex. une autre quête) : on la prévient.
      announceDeepLink(item.href!);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // Le focus reste dans la palette : Tab descend, Maj+Tab remonte.
      e.preventDefault();
      setActive((a) => (flat.length ? (a + (e.shiftKey ? -1 : 1) + flat.length) % flat.length : 0));
    }
  }

  if (!open) return null;
  let idx = -1;
  const activeId = flat[active] ? `palette-opt-${active}` : undefined;

  return createPortal(
    <div className="palette-backdrop" onMouseDown={close}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Rechercher dans le S.I.D." onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <SidIcon name="magnifier" size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Une page, un membre, une quête, un objet…"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="palette-kbd kbd-only">Échap</kbd>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" aria-label="Résultats" className="palette-list">
          {sections.map((s) => (
            <div key={s.label} role="group" aria-label={s.label}>
              <p className="palette-group" aria-hidden>
                {s.label}
              </p>
              {s.items.map((item) => {
                idx++;
                const i = idx;
                return (
                  <div
                    key={`${s.label}-${item.id}`}
                    id={`palette-opt-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={i === active}
                    className={`palette-opt ${i === active ? "is-active" : ""}`}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(item)}
                  >
                    {item.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.avatar} alt="" className="palette-avatar" loading="lazy" />
                    ) : (
                      <span className={`palette-ic palette-ic-${item.kind}`}>
                        <SidIcon name={item.icon} size={18} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display uppercase tracking-wide">{item.label}</span>
                      {item.hint && <span className="block truncate font-body text-xs text-paper/65">{item.hint}</span>}
                    </span>
                    {item.external && <span className="palette-tag">Nouvel onglet</span>}
                    {i === active && <span className="palette-enter" aria-hidden>↵</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {query.trim() && flat.length === 0 && (
            <p className="px-4 py-8 text-center font-body text-sm text-paper/70">
              {data ? <>Rien ne correspond à « {query.trim()} ».</> : "Recherche en cours…"}
            </p>
          )}
        </div>

        <div className="palette-foot kbd-only" aria-hidden>
          <span>
            <kbd className="palette-kbd">↑</kbd>
            <kbd className="palette-kbd">↓</kbd> naviguer
          </span>
          <span>
            <kbd className="palette-kbd">↵</kbd> ouvrir
          </span>
          <span className="ml-auto">
            <kbd className="palette-kbd">Ctrl</kbd> <kbd className="palette-kbd">K</kbd> partout
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Bouton de l'en-tête : une barre de recherche sur ordinateur, une loupe sur téléphone. */
export function PaletteButton() {
  const [mac, setMac] = useState(false);
  // Écran tactile : pas de clavier, donc pas de raccourci à proposer.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setMac(/Mac/.test(navigator.platform));
    setTouch(window.matchMedia("(hover: none), (pointer: coarse)").matches);
  }, []);
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label={touch ? "Rechercher" : `Rechercher (${mac ? "⌘" : "Ctrl"}+K)`}
      aria-keyshortcuts="Control+K Meta+K"
      className="palette-trigger flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 font-mono text-xs text-paper/70 hover:border-blue/50 hover:text-paper"
    >
      <SidIcon name="magnifier" />
      <span className="hidden lg:inline">Rechercher</span>
      <kbd className="palette-kbd kbd-only hidden lg:inline">{mac ? "⌘" : "Ctrl"} K</kbd>
    </button>
  );
}
