"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";

/** Carte d'un réglage : pastille d'icône, titre, phrase d'explication, contenu. */
export function SettingCard({
  icon,
  title,
  intro,
  children,
  aside,
  id,
  tuto,
}: {
  icon: IconName;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  id?: string;
  tuto?: string;
}) {
  return (
    <section id={id} data-tuto={tuto} className="glass-card reglage-card scroll-mt-28">
      <header className="reglage-head">
        <span className="reglage-pastille" aria-hidden>
          <SidIcon name={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="reglage-titre">{title}</h2>
          {intro && <p className="reglage-intro">{intro}</p>}
        </div>
        {aside}
      </header>
      {children && <div className="reglage-corps">{children}</div>}
    </section>
  );
}

/** Interrupteur accessible (case à cocher habillée). */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={clsx("reglage-ligne", disabled && "is-off")}>
      <span className="min-w-0 flex-1">
        <span className="reglage-ligne-titre">{label}</span>
        {hint && <span className="reglage-ligne-aide">{hint}</span>}
      </span>
      <span className="interrupteur">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden />
      </span>
    </label>
  );
}

/** Choix parmi quelques cartes (une seule active). */
export function Choices<T extends string>({
  value,
  onChange,
  options,
  label,
  cols = 3,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { v: T; title: string; hint?: string; visual?: ReactNode }[];
  label: string;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("choix-grille", `cols-${cols}`)}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={clsx("choix", value === o.v && "is-on")}
        >
          {o.visual && <span className="choix-visuel" aria-hidden>{o.visual}</span>}
          <span className="choix-titre">{o.title}</span>
          {o.hint && <span className="choix-aide">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

/** Petit message d'état (enregistré, erreur). */
export function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role="status" className={clsx("reglage-statut", msg.ok ? "is-ok" : "is-ko")}>
      <SidIcon name={msg.ok ? "check" : "warning"} /> {msg.text}
    </p>
  );
}
