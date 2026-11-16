import { createElement, Fragment } from "react";
import Link from "next/link";
import { GLITCH, avatarKey } from "@/lib/glitch";
import { GlitchName } from "@/components/glitch/GlitchName";

/**
 * Couche JSX, lieu inconnu (Lot 81) : dans le texte rendu par le site, le
 * pseudo d'un membre brouillé devient un GlitchName, et son avatar
 * (<img src=…>) prend la classe gl-avatar. Rien ne change tant que personne
 * n'est brouillé. Fichier identique dans les trois sites.
 */

// Balises dont le texte est affiché tel quel. Jamais option, textarea, title,
// ni le SVG (<text>), où un <span> n'a pas sa place.
const HOSTS = new Set(
  (
    "a abbr article aside b bdi blockquote button caption cite dd del dfn div dt em figcaption footer " +
    "h1 h2 h3 h4 h5 h6 header i ins label legend li main mark nav p q s section small span strong sub " +
    "summary sup td th time u"
  ).split(" "),
);

function split(s: string): unknown {
  const re = GLITCH.re;
  if (!re || s.length < 2) return s;
  re.lastIndex = 0;
  if (!re.test(s)) return s;
  re.lastIndex = 0;
  const out: unknown[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const at = m.index + m[1].length;
    if (at > last) out.push(s.slice(last, at));
    out.push(createElement(GlitchName, { key: `gl${k++}`, name: m[2] }));
    last = at + m[2].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function walk(c: unknown): unknown {
  if (typeof c === "string") return split(c);
  if (Array.isArray(c)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < c.length; i++) {
      const v = walk(c[i]);
      if (v !== c[i]) {
        out ??= c.slice();
        out[i] = v;
      }
    }
    return out ?? c;
  }
  return c;
}

export function glitchProps(type: unknown, props: Record<string, unknown>) {
  if (!GLITCH.on) return props;
  let out = props;
  if (type === "img" && typeof props.src === "string" && GLITCH.avatars.has(avatarKey(props.src))) {
    out = { ...props, className: `${typeof props.className === "string" ? props.className : ""} gl-avatar`.trim() };
  }
  const ok = typeof type === "string" ? HOSTS.has(type) : type === Fragment || type === Link;
  if (!ok || props.children == null || "data-noglitch" in props) return out;
  const c = walk(props.children);
  return c === props.children ? out : { ...out, children: c };
}
