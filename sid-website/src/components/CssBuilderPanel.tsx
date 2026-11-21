"use client";

import type { CssBuilderOptions, AnimationPreset, BorderStyle, BackgroundMode } from "@/lib/profileCssBuilder";
import { ANIMATION_LABELS } from "@/lib/profileCssBuilder";
import { labelClass, inputClass } from "@/lib/ui";
import { SidIcon } from "@/components/icons/SidIcon";

const BORDER_STYLES: { value: BorderStyle; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "solid", label: "Continue" },
  { value: "dashed", label: "Pointillés" },
  { value: "double", label: "Double" },
];

const BACKGROUND_MODES: { value: BackgroundMode; label: string }[] = [
  { value: "none", label: "Transparent (garde le fond habituel)" },
  { value: "solid", label: "Couleur unie" },
  { value: "gradient", label: "Dégradé" },
];

const ANIMATION_ORDER: AnimationPreset[] = ["none", "glow-pulse", "scale-pulse", "float", "shimmer", "rainbow", "neon-flicker"];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#8fb3d9"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-paper-dark bg-transparent p-0.5"
        />
        <input className={`${inputClass} flex-1`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#8fb3d9" />
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>
        {label} — <span className="text-paper">{value}{unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue"
      />
    </div>
  );
}

export function CssBuilderPanel({
  accentLabel,
  options,
  onChange,
}: {
  accentLabel: string;
  options: CssBuilderOptions;
  onChange: (next: CssBuilderOptions) => void;
}) {
  function set<K extends keyof CssBuilderOptions>(key: K, value: CssBuilderOptions[K]) {
    onChange({ ...options, [key]: value });
  }

  return (
    <div className="editeur-style">
      <fieldset className="editeur-groupe">
        <legend className="reglage-sous-titre">Bordure</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bordure">
          {BORDER_STYLES.map((b) => (
            <button
              key={b.value}
              type="button"
              role="radio"
              aria-checked={options.borderStyle === b.value}
              onClick={() => set("borderStyle", b.value)}
              className={`puce-choix ${options.borderStyle === b.value ? "is-on" : ""}`}
            >
              <span className={`puce-bord is-${b.value}`} aria-hidden />
              {b.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {options.borderStyle !== "none" && (
            <>
              <ColorField label="Couleur" value={options.borderColor} onChange={(v) => set("borderColor", v)} />
              <SliderField label="Épaisseur" value={options.borderWidth} min={0} max={6} unit="px" onChange={(v) => set("borderWidth", v)} />
            </>
          )}
          <SliderField label="Arrondi des coins" value={options.borderRadius} min={0} max={32} unit="px" onChange={(v) => set("borderRadius", v)} />
        </div>
      </fieldset>

      <fieldset className="editeur-groupe">
        <legend className="reglage-sous-titre">Fond</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fond">
          {BACKGROUND_MODES.map((b) => (
            <button
              key={b.value}
              type="button"
              role="radio"
              aria-checked={options.backgroundMode === b.value}
              onClick={() => set("backgroundMode", b.value)}
              className={`puce-choix ${options.backgroundMode === b.value ? "is-on" : ""}`}
            >
              {b.value === "none" ? "Habituel" : b.label}
            </button>
          ))}
        </div>
        {options.backgroundMode !== "none" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              label={options.backgroundMode === "gradient" ? "Couleur 1" : "Couleur"}
              value={options.backgroundColor}
              onChange={(v) => set("backgroundColor", v)}
            />
            {options.backgroundMode === "gradient" && (
              <>
                <ColorField label="Couleur 2" value={options.gradientColor} onChange={(v) => set("gradientColor", v)} />
                <SliderField label="Angle du dégradé" value={options.gradientAngle} min={0} max={360} unit="°" onChange={(v) => set("gradientAngle", v)} />
              </>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="editeur-groupe">
        <legend className="reglage-sous-titre">Lueur et accent</legend>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-blue" checked={options.glowEnabled} onChange={(e) => set("glowEnabled", e.target.checked)} />
          Lueur autour de la carte
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {options.glowEnabled && (
            <>
              <ColorField label="Couleur de la lueur" value={options.glowColor} onChange={(v) => set("glowColor", v)} />
              <SliderField label="Intensité" value={options.glowIntensity} min={0} max={100} unit="%" onChange={(v) => set("glowIntensity", v)} />
            </>
          )}
          <ColorField label={`Accent (${accentLabel})`} value={options.accentColor} onChange={(v) => set("accentColor", v)} />
        </div>
      </fieldset>

      <fieldset className="editeur-groupe">
        <legend className="reglage-sous-titre">
          <SidIcon name="sparkle" /> Animation
        </legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Animation">
          {ANIMATION_ORDER.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={options.animation === a}
              onClick={() => set("animation", a)}
              className={`puce-choix ${options.animation === a ? "is-on" : ""}`}
            >
              {ANIMATION_LABELS[a]}
            </button>
          ))}
        </div>
        {options.animation !== "none" && (
          <div className="seg-reglage" role="radiogroup" aria-label="Vitesse">
            {(["slow", "normal", "fast"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={options.animationSpeed === v} onClick={() => set("animationSpeed", v)} className={options.animationSpeed === v ? "is-on" : ""}>
                {v === "slow" ? "Lente" : v === "normal" ? "Normale" : "Rapide"}
              </button>
            ))}
          </div>
        )}
        {options.animation === "neon-flicker" && (
          <p className="text-xs opacity-70">S&apos;applique à la couleur d&apos;accent, pas au reste de la carte.</p>
        )}
      </fieldset>
    </div>
  );
}
