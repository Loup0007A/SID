import type { ShopItemEffect } from "@/types/database";

/**
 * Effets d'objets du comptoir (Lot 84). Un admin en donne un à un objet ;
 * chaque exemplaire acheté (ou gagné dans une boîte chanceuse) s'utilise une
 * fois depuis « Mes achats ». Côté base : use_item_effect().
 */

type Value = { label: string; unit: (n: number) => string; min: number; max: number; def: number };

export type ShopEffectInfo = {
  label: string;
  icon: "hourglass" | "flask" | "shield" | "medal" | "padlock";
  /** Ce que fait un exemplaire, avec son réglage. */
  describe: (value: number) => string;
  /** Réglage demandé à la création de l'objet. */
  value?: Value;
};

export const SHOP_EFFECTS: Record<ShopItemEffect, ShopEffectInfo> = {
  reset_cooldowns: {
    label: "Réinitialisation des délais",
    icon: "hourglass",
    describe: () => "Efface tous tes délais d'attente dans les simulations.",
  },
  heal_injury: {
    label: "Soin",
    icon: "flask",
    describe: () => "Guérit tes blessures de simulation : tu peux y retourner tout de suite.",
  },
  prank_shield: {
    label: "Bouclier anti-farces",
    icon: "shield",
    describe: (h) => `Arrête les farces en cours contre toi et t'en protège pendant ${h} h.`,
    value: { label: "Durée de la protection", unit: (n) => `${n} h`, min: 1, max: 168, def: 24 },
  },
  fame: {
    label: "Renommée",
    icon: "medal",
    describe: (n) => `Ajoute ${n} point${n > 1 ? "s" : ""} de renommée.`,
    value: { label: "Points de renommée", unit: (n) => `+${n}`, min: 1, max: 1000, def: 10 },
  },
  envers_key: {
    label: "Clé de la faille",
    icon: "padlock",
    describe: () => "Ouvre L'Envers de la Cartographie, comme si tu venais de trouver la faille.",
  },
};

export const SHOP_EFFECT_KEYS = Object.keys(SHOP_EFFECTS) as ShopItemEffect[];

/** Réglage effectif d'un objet (borné comme en base). */
export function effectValue(effect: ShopItemEffect, value: number | null | undefined): number {
  const v = SHOP_EFFECTS[effect].value;
  if (!v) return 0;
  return Math.min(v.max, Math.max(v.min, Math.round(value ?? v.def)));
}

export function effectSummary(effect: ShopItemEffect, value: number | null | undefined) {
  const info = SHOP_EFFECTS[effect];
  return info.describe(effectValue(effect, value));
}
