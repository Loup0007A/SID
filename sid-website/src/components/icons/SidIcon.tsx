import { Fragment, type ReactNode } from "react";
import { ICONS, type IconName } from "./sidIcons";

export type { IconName };

/**
 * Une icône du S.I.D. (voir sidIcons.tsx). `size` en px ou en unité CSS
 * (par défaut 1.15em : elle suit la taille du texte).
 */
export function SidIcon({ name, size = "1.15em", className = "", title }: { name: IconName; size?: number | string; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`sid-ic ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "inline-block", verticalAlign: "-0.2em", flex: "none", overflow: "visible" }}
    >
      {ICONS[name]}
    </svg>
  );
}

/** La même icône, posée dans un dessin SVG (centrée sur x, y ; `size` en unités du dessin). */
export function SvgIcon({ name, x = 0, y = 0, size }: { name: IconName; x?: number; y?: number; size: number }) {
  return (
    <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 48 48" overflow="visible" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/** Émojis encore présents dans des textes (base de données, anciennes chaînes) → icône. */
export const ICON_FOR_EMOJI: Record<string, IconName> = {
  "🪪": "idcard", "💬": "chat", "🔔": "bell", "🏅": "medal", "⚙": "gear", "🔐": "padlock", "🔒": "padlock",
  "📜": "scroll", "🌳": "tree", "🗺": "map", "🏆": "trophy", "🏛": "orgchart", "👥": "people", "🏰": "castle",
  "🥋": "gi", "🛒": "cart", "🏦": "bank", "🏢": "office", "📋": "clipboard", "🎖": "rank",
  "💰": "coins", "🧬": "dna", "📊": "chart", "📈": "chart", "🛡": "shieldUser", "🚨": "siren", "⚖": "scales", "🎭": "masks",
  "🕵": "magnifier", "🏠": "home", "⚔": "swords", "🎥": "camera", "🧭": "compass", "📣": "megaphone", "⚠": "warning",
  "✅": "check", "❌": "cross", "⏳": "hourglass", "🤑": "moneyFly", "🗑": "trash", "💡": "bulb", "🏷": "tag",
  "🥇": "podium1", "🥈": "podium2", "🥉": "podium3", "🍬": "candy", "🍭": "lollipop", "🍫": "chocolate",
  "❄": "snowflake", "✨": "sparkle", "⭐": "starGold", "🎉": "sparkle",
  "🎃": "pumpkin", "🎄": "fir", "💘": "heartArrow", "🐟": "fish", "🥚": "egg", "🌿": "muguet", "🎵": "notes",
  "🎆": "firework", "🕊": "dove", "🏹": "bow", "🐉": "dragon", "🕸": "web", "⚡": "bolt", "👻": "ghost", "🎁": "gift",
  "🌊": "wave", "💋": "lips", "🪶": "quill", "🦇": "bat", "🧝": "elfHat", "✊": "fist", "🎼": "clef", "🐾": "claws",
  "💀": "skull", "🛸": "ufo", "🎂": "cake", "🎈": "balloon", "🥂": "champagne", "🪩": "disco", "🕺": "disco", "🪅": "masks",
  "🥔": "potato", "🏴": "pirate", "🍼": "bottle", "😈": "demon", "🦎": "lizard", "🔥": "fire", "🦷": "tooth", "👁": "eye",
  "🖱": "mouse", "🐙": "octopus", "🐠": "tropical", "🐡": "fish", "🦑": "octopus", "🪼": "jelly", "🏃": "runner", "💨": "runner",
  "🗡": "dagger", "📅": "calendar", "🕐": "clock", "🎮": "gamepad", "🧾": "receipt", "💸": "moneyFly", "🏪": "store",
  "👣": "footprints", "💪": "muscle", "🤍": "heart", "💗": "heart", "💖": "heart", "💕": "heart", "❤": "heart", "🌷": "tulip",
  "🐣": "chick", "🎶": "notes", "🎇": "sparkle", "🎊": "sparkle", "🥳": "sparkle", "🍰": "cake", "🦄": "sparkle", "🟢": "check",
  "✉": "envelope", "🚧": "cone", "✍": "pen", "🎲": "dice", "👑": "crown", "👶": "baby", "📒": "book", "📲": "phone", "🎒": "backpack", "⏻": "power",
  "📍": "pin", "🛣": "road", "ℹ": "info", "🧪": "flask", "🛷": "sleigh", "💥": "boom",
  "❓": "question", "🛠": "tools", "🧰": "tools", "🚩": "flag", "🎬": "film", "🔗": "link", "🖨": "printer", "🪖": "helmet", "👖": "pants",
  "🥾": "boot", "👋": "hello", "📡": "radar", "🕶": "shades", "💎": "gem", "🎨": "palette", "🐴": "horse", "🐎": "horse", "🚶": "walker",
  "🗂": "layers", "🏔": "mountain", "⛰": "mountain", "🌱": "leafy", "📐": "ruler", "🧙": "mage", "🖼": "frame", "📝": "memo", "📚": "book",
  "📖": "book", "📓": "book", "👤": "profile", "🧍": "walker", "🔍": "magnifier", "🔎": "magnifier", "🕘": "clock", "🪙": "coins", "🗝": "padlock",
  "🆕": "sparkle", "⏱": "clock", "🔑": "padlock", "🏙": "office", "🏗": "cone", "✏": "pen",
};

const EMOJI_RE = /(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)/u;

/** L'icône d'un émoji (si elle existe), sinon l'émoji tel quel. */
export function Glyph({ e, size, className }: { e: string; size?: number | string; className?: string }) {
  const bare = e.replace(/\uFE0F/g, "");
  const name = ICON_FOR_EMOJI[bare] ?? ICON_FOR_EMOJI[String.fromCodePoint(bare.codePointAt(0) ?? 32)];
  if (name) return <SidIcon name={name} size={size} className={className} />;
  return (
    <span aria-hidden className={className}>
      {e}
    </span>
  );
}

/** Un texte où les émojis connus deviennent des icônes. */
export function GlyphText({ text, size }: { text: string; size?: number | string }): ReactNode {
  const parts = text.split(EMOJI_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <Glyph key={i} e={p} size={size} /> : <Fragment key={i}>{p}</Fragment>
      )}
    </>
  );
}

/** Le texte sans son émoji de tête (pour les titres de notification, par exemple). */
export function splitLeadingEmoji(text: string): { emoji: string | null; rest: string } {
  const m = text.match(/^\s*(\p{Extended_Pictographic}\uFE0F?)\s*/u);
  return m ? { emoji: m[1], rest: text.slice(m[0].length) } : { emoji: null, rest: text };
}
