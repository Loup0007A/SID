"use client";

import type { CssBuilderOptions, AnimationPreset, BorderStyle, BackgroundMode } from "@/lib/profileCssBuilder";
import { ANIMATION_LABELS } from "@/lib/profileCssBuilder";
import { labelClass, inputClass } from "@/lib/ui";

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
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass}>Bordure</label>
          <select className={inputClass} value={options.borderStyle} onChange={(e) => set("borderStyle", e.target.value as BorderStyle)}>
            {BORDER_STYLES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        {options.borderStyle !== "none" && (
          <>
            <ColorField label="Couleur de la bordure" value={options.borderColor} onChange={(v) => set("borderColor", v)} />
            <SliderField label="Épaisseur" value={options.borderWidth} min={0} max={6} unit="px" onChange={(v) => set("borderWidth", v)} />
          </>
        )}
        <SliderField label="Arrondi des coins" value={options.borderRadius} min={0} max={32} unit="px" onChange={(v) => set("borderRadius", v)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Fond</label>
          <select className={inputClass} value={options.backgroundMode} onChange={(e) => set("backgroundMode", e.target.value as BackgroundMode)}>
            {BACKGROUND_MODES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        {options.backgroundMode !== "none" && (
          <ColorField
            label={options.backgroundMode === "gradient" ? "Couleur 1" : "Couleur de fond"}
            value={options.backgroundColor}
            onChange={(v) => set("backgroundColor", v)}
          />
        )}
        {options.backgroundMode === "gradient" && (
          <>
            <ColorField label="Couleur 2" value={options.gradientColor} onChange={(v) => set("gradientColor", v)} />
            <SliderField label="Angle du dégradé" value={options.gradientAngle} min={0} max={360} unit="°" onChange={(v) => set("gradientAngle", v)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 font-mono text-xs sm:col-span-2">
          <input type="checkbox" className="accent-blue" checked={options.glowEnabled} onChange={(e) => set("glowEnabled", e.target.checked)} />
          Lueur autour de la carte
        </label>
        {options.glowEnabled && (
          <>
            <ColorField label="Couleur de la lueur" value={options.glowColor} onChange={(v) => set("glowColor", v)} />
            <SliderField label="Intensité" value={options.glowIntensity} min={0} max={100} unit="%" onChange={(v) => set("glowIntensity", v)} />
          </>
        )}
      </div>

      <ColorField label={`Couleur d'accent (${accentLabel})`} value={options.accentColor} onChange={(v) => set("accentColor", v)} />

      <div className="space-y-2 border-t border-white/10 pt-4">
        <label className={labelClass}>✨ Animation</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ANIMATION_ORDER.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => set("animation", a)}
              className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide transition ${
                options.animation === a
                  ? "border-blue bg-blue/20 text-blue-light"
                  : "border-white/15 text-paper/70 hover:border-blue/50 hover:text-paper"
              }`}
            >
              {ANIMATION_LABELS[a]}
            </button>
          ))}
        </div>
        {options.animation !== "none" && (
          <div className="max-w-xs space-y-1">
            <label className={labelClass}>Vitesse</label>
            <select className={inputClass} value={options.animationSpeed} onChange={(e) => set("animationSpeed", e.target.value as CssBuilderOptions["animationSpeed"])}>
              <option value="slow">Lente</option>
              <option value="normal">Normale</option>
              <option value="fast">Rapide</option>
            </select>
          </div>
        )}
        {options.animation === "neon-flicker" && (
          <p className="font-mono text-[10px] text-paper/50">
            S&apos;applique à la couleur d&apos;accent ci-dessus, pas au reste de la carte.
          </p>
        )}
      </div>
    </div>
  );
}
