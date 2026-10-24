"use client";

import { BatShape, SnowLayers } from "@/components/trolls/EventEffects";
import { Bells, Bleuet, Egg, PaperFish, Patrouille } from "@/components/seasonal/drawings";
import { Brasombre, ClawMarks } from "@/components/seasonal/chasseArt";
import { VaryexisSign } from "@/components/seasonal/varyexisArt";
import { BalanceArt } from "@/components/trolls/BalanceEffects";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { mentalQuestion } from "@/lib/mentalCalc";
import type { TrollPower } from "@/lib/titles";
import { DragonSvg } from "@/components/titles/TitleVisuals";
import { BailiffText } from "@/components/trolls/AmbientEffects";
import {
  ABYSS_SPEEDS,
  ARENA_PRICES,
  BAILIFF_DEFAULT_ITEMS,
  BAILIFF_TONES,
  BAILIFF_WORDS,
  BEASTS,
  DRAGON_FINALES,
  DRAGON_SKINS,
  FANFARE_TEMPOS,
  FLATTERY_COLORS,
  FLATTERY_DEFAULT,
  HAUNT_CREATURES,
  LOVE_COLORS,
  MIRROR_MODES,
  PARTY_CURSORS,
  PARTY_THEMES,
  REWRITE_THEMES,
  arenaCost,
  hauntMaxCatches,
  hauntMaxChance,
  makeRewriter,
  type AbyssSpeed,
  type ArenaPrices,
  type BailiffTone,
  type BeastKind,
  type DragonFinale,
  type DragonSkin,
  type FanfareTempo,
  type HauntCreature,
  type LoveColor,
  type MirrorMode,
  type PartyTheme,
  type RewriteTheme,
  type TrollOptions,
} from "@/lib/trollOptions";

/* ---------------------------------------------------------------
   Briques
   --------------------------------------------------------------- */

type Ctx = {
  accent: string;
  me: string;
  target: string;
  level: number;
  balance: number;
  members: { id: string; nickname: string }[];
  targetId: string;
  prices?: ArenaPrices;
};

const zenis = (n: number) => `${n.toLocaleString("fr-FR")} z`;

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">{label}</p>
      {children}
      {hint && <p className="font-body text-[11px] text-paper/50">{hint}</p>}
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onChange, accent }: { value: T; options: { v: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; accent: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            title={o.title}
            onClick={() => onChange(o.v)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition ${on ? "text-ink" : "border-white/20 text-paper/70 hover:bg-white/10"}`}
            style={on ? { background: accent, borderColor: accent } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange, accent, unit = "", format }: { value: number; min: number; max: number; step?: number; onChange: (n: number) => void; accent: string; unit?: string; format?: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" style={{ accentColor: accent }} />
      <span className="w-16 text-right font-mono text-xs text-paper">{format ? format(value) : `${value}${unit}`}</span>
    </div>
  );
}

function Toggle({ checked, onChange, label, accent }: { checked: boolean; onChange: (b: boolean) => void; label: ReactNode; accent: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 font-body text-sm text-paper/80">
      <span
        className="relative h-5 w-9 shrink-0 rounded-full border border-white/20 transition"
        style={{ background: checked ? accent : "rgb(255 255 255 / 0.08)" }}
      >
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-paper shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function TextInput({ value, onChange, max, placeholder }: { value: string; onChange: (s: string) => void; max: number; placeholder?: string }) {
  return (
    <div className="relative">
      <input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 pr-12 font-body text-sm text-paper outline-none placeholder:text-paper/30 focus:border-white/40"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-paper/40">{max - value.length}</span>
    </div>
  );
}

/** Cadre d'aperçu : ce que verra la cible. */
function Preview({ who, children, className = "" }: { who: string; children: ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-paper/50">👁 Aperçu — ce que verra {who}</p>
      <div className={`troll-preview relative overflow-hidden rounded-xl border border-white/10 ${className}`}>{children}</div>
    </div>
  );
}

/** Mini-page du S.I.D. pour les aperçus. */
function MiniPage({ title = "Accueil", lines = ["Bienvenue au S.I.D.", "Tes quêtes du jour", "Solde : 12 400 zénis"] }: { title?: string; lines?: string[] }) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#ff5d6c]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd34d]" />
        <span className="h-2 w-2 rounded-full bg-[#7dffb0]" />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-paper/50">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {lines.map((l, i) => (
          <div key={i} className="rounded-md border border-white/10 bg-white/5 p-2 font-body text-[11px] text-paper/80">
            {l}
          </div>
        ))}
      </div>
      <div className="h-2 w-3/4 rounded bg-white/10" />
      <div className="h-2 w-1/2 rounded bg-white/10" />
    </div>
  );
}

/* ---------------------------------------------------------------
   Panneaux
   --------------------------------------------------------------- */

type Props<P extends TrollPower> = { value: TrollOptions[P]; onChange: (v: TrollOptions[P]) => void; ctx: Ctx };

function CalcPanel({ value: o, onChange, ctx }: Props<"calcul">) {
  const set = (p: Partial<TrollOptions["calcul"]>) => onChange({ ...o, ...p });
  const [q, setQ] = useState(() => mentalQuestion(o.level));
  useEffect(() => setQ(mentalQuestion(o.level)), [o.level]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Calculs à réussir par page">
          <Slider value={o.count} min={1} max={5} onChange={(count) => set({ count })} accent={ctx.accent} />
        </Field>
        <Field label="Difficulté" hint={`${q.seconds} s par calcul. Niveau 20 : additions ; niveau 80 : carrés, pourcentages, multiplications à deux chiffres.`}>
          <Slider value={o.level} min={20} max={80} step={5} onChange={(level) => set({ level })} accent={ctx.accent} format={(n) => `niv. ${n}`} />
        </Field>
        <Toggle checked={o.reset} onChange={(reset) => set({ reset })} accent={ctx.accent} label="Une erreur remet le compteur à zéro" />
      </div>
      <Preview who={ctx.target} className="bg-[#0d0f16]">
        <div className="space-y-3 p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ffe95c]">⚡ Contrôle de vivacité</p>
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: o.count }, (_, i) => (
              <span key={i} className={`h-2 w-8 rounded-full ${i === 0 ? "bg-[#ffe95c]" : "bg-white/15"}`} />
            ))}
          </div>
          <p className="font-display text-3xl tracking-wide text-paper">{q.q}</p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="troll-preview-timer h-full bg-gradient-to-r from-[#ffe95c] to-[#ff8a00]" style={{ animationDuration: `${q.seconds}s` }} key={q.q} />
          </div>
          <button type="button" onClick={() => setQ(mentalQuestion(o.level))} className="font-mono text-[10px] uppercase text-paper/50 underline">
            Autre exemple (réponse : {q.r})
          </button>
        </div>
      </Preview>
    </div>
  );
}

function HauntPanel({ value: o, onChange, ctx }: Props<"hantise">) {
  const set = (p: Partial<TrollOptions["hantise"]>) => onChange({ ...o, ...p });
  const maxC = hauntMaxChance(ctx.level);
  const maxK = hauntMaxCatches(ctx.level);
  const c = HAUNT_CREATURES[o.creature];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Créature">
          <Seg value={o.creature} onChange={(creature) => set({ creature: creature as HauntCreature })} accent={ctx.accent} options={(Object.keys(HAUNT_CREATURES) as HauntCreature[]).map((k) => ({ v: k, label: `${HAUNT_CREATURES[k].emoji} ${HAUNT_CREATURES[k].label}` }))} />
        </Field>
        <Field label="Pages hantées" hint={`Jusqu'à ${maxC} % au niveau ${ctx.level} du titre.`}>
          <Slider value={Math.min(o.chance, maxC)} min={10} max={maxC} step={5} onChange={(chance) => set({ chance })} accent={ctx.accent} unit=" %" />
        </Field>
        <Field label="Captures pour sortir">
          <Slider value={Math.min(o.catches, maxK)} min={1} max={maxK} onChange={(catches) => set({ catches })} accent={ctx.accent} />
        </Field>
        <Field label="Message sur la fausse 404 (facultatif)">
          <TextInput value={o.message} onChange={(message) => set({ message })} max={80} placeholder="Cette page a été dévorée par…" />
        </Field>
      </div>
      <Preview who={ctx.target} className="bg-[#262a38]">
        <div className="relative flex h-56 items-center justify-center p-4">
          <div className="max-w-[16rem] space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-4 text-center">
            <p className="troll-glitch-text font-mono text-[10px] uppercase tracking-[0.3em] text-red">Erreur 404</p>
            <p className="font-display text-lg uppercase">Dossier introuvable</p>
            <p className="font-body text-[11px] text-paper/70">{o.message || "Cette page n'existe pas…"}</p>
            <p className="font-mono text-[10px] text-paper/50">Attrape {c.emoji} de {ctx.me} : 0 / {Math.min(o.catches, maxK)}</p>
          </div>
          <span className="troll-preview-haunt absolute text-4xl">{c.emoji}</span>
        </div>
      </Preview>
    </div>
  );
}

function PartyPanel({ value: o, onChange, ctx, everyone }: Props<"fete"> & { everyone: boolean }) {
  const set = (p: Partial<TrollOptions["fete"]>) => onChange({ ...o, ...p });
  const theme = PARTY_THEMES[o.theme];
  const banner = o.message || (everyone ? `${ctx.me} offre une fête à tout le S.I.D. !` : theme.banner(ctx.target));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Thème">
          <Seg value={o.theme} onChange={(t) => set({ theme: t as PartyTheme })} accent={ctx.accent} options={(Object.keys(PARTY_THEMES) as PartyTheme[]).map((k) => ({ v: k, label: `${PARTY_THEMES[k].emoji} ${PARTY_THEMES[k].label}` }))} />
        </Field>
        <Field label="Bannière (facultatif)">
          <TextInput value={o.message} onChange={(message) => set({ message })} max={80} placeholder={theme.banner(everyone ? "tout le monde" : ctx.target)} />
        </Field>
        <Field label="Densité de confettis">
          <Seg value={o.density} onChange={(density) => set({ density })} accent={ctx.accent} options={[{ v: 1, label: "Léger" }, { v: 2, label: "Festif" }, { v: 3, label: "Déluge" }]} />
        </Field>
        <Field label="Curseur">
          <Seg value={o.cursor} onChange={(cursor) => set({ cursor })} accent={ctx.accent} options={PARTY_CURSORS.map((c) => ({ v: c, label: <span className="text-base">{c}</span> }))} />
        </Field>
      </div>
      <Preview who={everyone ? "tout le S.I.D." : ctx.target} className="bg-ink" key={o.theme + o.density}>
        <div className="py-1 text-center font-display text-[11px] uppercase tracking-wider text-ink" style={{ backgroundImage: `linear-gradient(90deg, ${[...theme.colors, theme.colors[0]].join(", ")})` }}>
          {theme.emoji} {banner} {theme.emoji}
        </div>
        <MiniPage />
        {Array.from({ length: 8 + o.density * 8 }, (_, i) => (
          <span key={i} className="troll-preview-confetto absolute h-2 w-1.5 rounded-[1px]" style={{ left: `${(i * 37) % 100}%`, background: theme.colors[i % theme.colors.length], animationDelay: `${-((i * 0.37) % 3)}s` }} />
        ))}
        <span className="absolute bottom-3 right-6 text-2xl">{o.cursor}</span>
        <span className="troll-preview-float absolute bottom-0 left-4 text-2xl">{theme.floaters[0]}</span>
      </Preview>
    </div>
  );
}

function NueePanel({ value: o, onChange, ctx }: Props<"nuee">) {
  const set = (p: Partial<TrollOptions["nuee"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Nuées" hint="Fréquence et taille des vols qui traversent l'écran.">
          <Seg value={o.density} onChange={(density) => set({ density })} accent={ctx.accent} options={[{ v: 1, label: "Quelques-unes" }, { v: 2, label: "Une nuée" }, { v: 3, label: "Le ciel noir" }]} />
        </Field>
        <Field label="Accrochées en haut de la page" hint="Il faut cliquer dessus pour les chasser ; elles reviennent.">
          <Slider value={o.hanging} min={0} max={5} onChange={(hanging) => set({ hanging })} accent={ctx.accent} />
        </Field>
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        {Array.from({ length: o.hanging }, (_, i) => (
          <span key={i} className="troll-bat-hang" style={{ left: `${10 + i * 17}%`, top: "6px" }}>
            <BatShape folded />
          </span>
        ))}
        {Array.from({ length: [4, 7, 11][o.density - 1] }, (_, i) => (
          <BatShape
            key={`${o.density}-${i}`}
            className="troll-bat-fly"
            style={{ top: `${20 + ((i * 37) % 60)}%`, animationIterationCount: "infinite", "--d": `${(i % 5) * 0.3}s`, "--s": 0.7, "--y": "0px", "--t": "3.6s" } as React.CSSProperties}
          />
        ))}
      </Preview>
    </div>
  );
}

function BlizzardPanel({ value: o, onChange, ctx }: Props<"blizzard">) {
  const set = (p: Partial<TrollOptions["blizzard"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Tempête">
          <Seg value={o.intensity} onChange={(intensity) => set({ intensity })} accent={ctx.accent} options={[{ v: 1, label: "Flocons" }, { v: 2, label: "Tempête" }, { v: 3, label: "Blizzard" }]} />
        </Field>
        <Toggle checked={o.frost} onChange={(frost) => set({ frost })} accent={ctx.accent} label="Givre sur l'écran (il faut frotter pour y voir clair) ❄" />
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        <SnowLayers intensity={o.intensity} />
        {o.frost && <div className="troll-frost" style={{ "--frost": [0.5, 0.65, 0.8][o.intensity - 1] } as React.CSSProperties} />}
      </Preview>
    </div>
  );
}

function LovePanel({ value: o, onChange, ctx }: Props<"coup_de_foudre">) {
  const set = (p: Partial<TrollOptions["coup_de_foudre"]>) => onChange({ ...o, ...p });
  const pal = LOVE_COLORS[o.color].colors;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Couleur des cœurs">
          <Seg value={o.color} onChange={(color) => set({ color: color as LoveColor })} accent={ctx.accent} options={(Object.keys(LOVE_COLORS) as LoveColor[]).map((k) => ({ v: k, label: LOVE_COLORS[k].label }))} />
        </Field>
        <Toggle checked={o.name} onChange={(name) => set({ name })} accent={ctx.accent} label={`Ton nom (${ctx.me}) passe dans un grand cœur`} />
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="troll-heart-rise" style={{ left: `${8 + i * 10}%`, color: pal[i % pal.length], fontSize: 14 + (i % 3) * 6, animationDuration: `${3 + (i % 4)}s`, animationIterationCount: "infinite", animationDelay: `${-i * 0.6}s`, "--dx": "10px", "--rise": "-240px" } as React.CSSProperties}>
            ♥
          </span>
        ))}
        {o.name && (
          <p className="absolute inset-x-0 top-1/2 text-center font-display text-2xl" style={{ color: pal[0], textShadow: `0 0 12px ${pal[0]}` }}>
            ♥ {ctx.me} ♥
          </p>
        )}
      </Preview>
    </div>
  );
}

function FoolsPanel({ value: o, onChange, ctx }: Props<"poisson">) {
  const set = (p: Partial<TrollOptions["poisson"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Poissons collés à l'écran" hint="Il faut cliquer pour les décoller ; ils reviennent.">
          <Slider value={o.count} min={2} max={12} onChange={(count) => set({ count })} accent={ctx.accent} />
        </Field>
        <Toggle checked={o.fake} onChange={(fake) => set({ fake })} accent={ctx.accent} label="Fausses notifications (« Tu as reçu 50 000 000 zénis… Poisson d'avril ! »)" />
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        {Array.from({ length: Math.min(o.count, 8) }, (_, i) => (
          <span key={i} className="absolute w-12" style={{ left: `${(i * 37) % 80 + 4}%`, top: `${(i * 23) % 70 + 10}%`, transform: `rotate(${(i % 2 ? 1 : -1) * (10 + i * 3)}deg)` }}>
            <PaperFish color={["#ff9a76", "#7fd8ff", "#ffd86b", "#c9a6ff"][i % 4]} />
          </span>
        ))}
      </Preview>
    </div>
  );
}

function BellsPanel({ value: o, onChange, ctx }: Props<"cloches">) {
  const set = (p: Partial<TrollOptions["cloches"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Œufs en chocolat" hint="Ils s'entassent en bas de l'écran ; il faut les croquer pour faire de la place.">
          <Seg value={o.amount} onChange={(amount) => set({ amount })} accent={ctx.accent} options={[{ v: 1, label: "Quelques-uns" }, { v: 2, label: "Une pluie" }, { v: 3, label: "Une avalanche" }]} />
        </Field>
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        <div className="absolute right-4 top-2 w-24">
          <Bells />
        </div>
        <div className="absolute inset-x-0 bottom-1 flex flex-wrap-reverse justify-center gap-0.5 px-4">
          {Array.from({ length: [5, 10, 18][o.amount - 1] }, (_, i) => (
            <span key={i} className="w-5">
              <Egg hue={i} />
            </span>
          ))}
        </div>
      </Preview>
    </div>
  );
}

function StrikePanel({ value: o, onChange, ctx }: Props<"greve">) {
  const set = (p: Partial<TrollOptions["greve"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Boutons en grève" hint="Un bouton en grève ne répond plus pendant quelques secondes.">
          <Seg value={o.every} onChange={(every) => set({ every })} accent={ctx.accent} options={[{ v: 1, label: "Grève perlée" }, { v: 2, label: "Grève" }, { v: 3, label: "Grève générale" }]} />
        </Field>
        <Toggle checked={o.placards} onChange={(placards) => set({ placards })} accent={ctx.accent} label="Manifestation avec pancartes en bas de l'écran ✊" />
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        <div className="troll-picket" style={{ position: "absolute", left: "8%", top: "56%", width: "38%", height: 26 }}>
          <span>EN GRÈVE ✊</span>
        </div>
        {o.placards && (
          <div className="absolute bottom-1 right-3 flex gap-2">
            <div className="troll-placard">
              <span className="!text-[9px]">Plus de zénis !</span>
              <i className="!h-4" />
            </div>
          </div>
        )}
      </Preview>
    </div>
  );
}

function FanfarePanel({ value: o, onChange, ctx }: Props<"fanfare">) {
  const set = (p: Partial<TrollOptions["fanfare"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Tempo">
          <Seg value={o.tempo} onChange={(tempo) => set({ tempo: tempo as FanfareTempo })} accent={ctx.accent} options={(Object.keys(FANFARE_TEMPOS) as FanfareTempo[]).map((k) => ({ v: k, label: FANFARE_TEMPOS[k].label }))} />
        </Field>
        <Toggle checked={o.bounce} onChange={(bounce) => set({ bounce })} accent={ctx.accent} label="Les cartes du site dansent en rythme" />
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <div style={{ animation: o.bounce ? `troll-fanfare-bounce ${FANFARE_TEMPOS[o.tempo].ms}ms ease-in-out infinite alternate` : undefined }}>
          <MiniPage />
        </div>
        {["♪", "♫", "♬", "♪", "♩"].map((g, i) => (
          <span key={i} className="troll-note-rise" style={{ left: `${10 + i * 18}%`, color: ["#c9a6ff", "#ff9c6e", "#6ec8ff", "#ffe14d"][i % 4], animationDuration: `${3 + i * 0.5}s`, animationIterationCount: "infinite", animationDelay: `${-i * 0.7}s`, "--dx": "12px", "--rise": "-240px" } as React.CSSProperties}>
            {g}
          </span>
        ))}
      </Preview>
    </div>
  );
}

function FireworksPanel({ value: o, onChange, ctx }: Props<"artifice">) {
  const set = (p: Partial<TrollOptions["artifice"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Feu d'artifice">
          <Seg value={o.intensity} onChange={(intensity) => set({ intensity })} accent={ctx.accent} options={[{ v: 1, label: "Bouquet" }, { v: 2, label: "Spectacle" }, { v: 3, label: "Final" }]} />
        </Field>
        <Toggle checked={o.patrouille} onChange={(patrouille) => set({ patrouille })} accent={ctx.accent} label="La Patrouille de France passe par-dessus 🇫🇷" />
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        {[
          [25, 35, "#6ea8ff"],
          [70, 25, "#ff5a5a"],
          [50, 55, "#ffd76a"],
        ].slice(0, o.intensity).map(([x, y, c], k) => (
          <span key={k} className="hd-fw" style={{ left: `${x}%`, top: `${y}%`, "--c": c, "--r": "40px" } as React.CSSProperties}>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--a": `${i * 30}deg`, animationDelay: `${k * 0.9}s`, animationDuration: "2.6s" } as React.CSSProperties} />
            ))}
          </span>
        ))}
        {o.patrouille && (
          <div className="absolute left-4 top-3 w-40 [transform:scaleX(-1)]">
            <Patrouille />
          </div>
        )}
      </Preview>
    </div>
  );
}

function TrucePanel({ value: o, onChange, ctx }: Props<"treve">) {
  const set = (p: Partial<TrollOptions["treve"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Ton message (facultatif)" hint="Affiché sous « … t'offre une trêve ».">
          <TextInput value={o.message} onChange={(message) => set({ message })} max={60} placeholder="Paix sur le S.I.D." />
        </Field>
        <p className="font-body text-xs text-paper/60">
          Une farce douce : des bleuets fleurissent sur le site de {ctx.target}, une colombe passe, et pendant 10 minutes personne ne peut le viser
          d&apos;une autre farce.
        </p>
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        <div className="absolute inset-x-6 top-3 rounded-lg border border-[#6f95ff]/50 bg-black/70 p-2 text-center font-body text-xs text-paper">
          🕊️ {ctx.me} t&apos;offre une trêve
          {o.message && <p className="italic text-[#b9ccff]">« {o.message} »</p>}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-around">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="w-5">
              <Bleuet />
            </span>
          ))}
        </div>
      </Preview>
    </div>
  );
}

function AssautPanel({ value: o, onChange, ctx }: Props<"assaut">) {
  const set = (p: Partial<TrollOptions["assaut"]>) => onChange({ ...o, ...p });
  const beast = BEASTS[o.beast];
  const hits = o.fury * 2 + 1;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Brasombre">
          <Seg value={o.beast} onChange={(b) => set({ beast: b as BeastKind })} accent={ctx.accent} options={(Object.keys(BEASTS) as BeastKind[]).map((k) => ({ v: k, label: BEASTS[k].label }))} />
        </Field>
        <Field label="Fureur" hint={["Un assaut toutes les minutes environ.", "Un assaut toutes les 40 secondes environ.", "Un assaut toutes les 20 secondes environ."][o.fury - 1]}>
          <Seg value={o.fury} onChange={(fury) => set({ fury })} accent={ctx.accent} options={[{ v: 1, label: "Grognon" }, { v: 2, label: "Furieuse" }, { v: 3, label: "Déchaînée" }]} />
        </Field>
        <Toggle checked={o.repel} onChange={(repel) => set({ repel })} accent={ctx.accent} label={`${ctx.target} peut la chasser (${hits} clics)`} />
        <Field label="Son cri (facultatif)" hint="Affiché dans une bulle quand elle se pose.">
          <TextInput value={o.message} onChange={(message) => set({ message })} max={60} placeholder="Rends-moi mon trophée !" />
        </Field>
      </div>
      <Preview who={ctx.target} className="h-48 bg-ink">
        <MiniPage />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 120%, ${beast.glow}33, transparent 60%)` }} />
        <ClawMarks className="absolute left-[10%] top-[12%] h-20 w-20 -rotate-12" style={{ "--claw-glow": beast.glow } as CSSProperties} />
        {o.fury >= 2 && <ClawMarks className="absolute left-[40%] top-[4%] h-16 w-16 rotate-12" style={{ "--claw-glow": beast.glow } as CSSProperties} />}
        {o.fury >= 3 && <ClawMarks className="absolute left-[18%] top-[48%] h-14 w-14 rotate-45" style={{ "--claw-glow": beast.glow } as CSSProperties} />}
        <div className="absolute -bottom-2 -right-2 w-[58%]">
          <Brasombre pose="perch" className={`${o.beast === "braise" ? "" : `is-${o.beast}`} [transform:scaleX(-1)]`} />
        </div>
        {o.message && (
          <div className="absolute bottom-[58%] right-[8%] max-w-[55%] rounded-lg border bg-black/80 px-2 py-1 font-body text-[11px] text-paper" style={{ borderColor: `${beast.glow}99` }}>
            {o.message}
          </div>
        )}
        {o.repel && (
          <span className="absolute bottom-2 left-3 rounded-full bg-black/70 px-2 py-0.5 font-body text-[10px] text-paper">
            Chasse-la ! <b style={{ color: beast.glow }}>{hits}</b>
          </span>
        )}
      </Preview>
    </div>
  );
}

function BalancePanel({ value: o, onChange, ctx }: Props<"balance">) {
  const set = (p: Partial<TrollOptions["balance"]>) => onChange({ ...o, ...p });
  const tilt = [1.5, 3, 5][o.penchant - 1];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Pluie d'étoiles" hint={["Une étoile toutes les 3 à 4 secondes.", "Une étoile toutes les 2 secondes environ.", "Plus d'une étoile par seconde."][o.rythme - 1]}>
          <Seg value={o.rythme} onChange={(rythme) => set({ rythme })} accent={ctx.accent} options={[{ v: 1, label: "Paisible" }, { v: 2, label: "Soutenue" }, { v: 3, label: "Averse" }]} />
        </Field>
        <Field label="Quand elle penche, la page penche">
          <Seg value={o.penchant} onChange={(penchant) => set({ penchant })} accent={ctx.accent} options={[{ v: 1, label: "Un peu" }, { v: 2, label: "Franchement" }, { v: 3, label: "Vertigineux" }]} />
        </Field>
        <Toggle checked={o.constellation} onChange={(constellation) => set({ constellation })} accent={ctx.accent} label="Le signe de Varyexis dans son ciel" />
        <Field label="Gravé sous la balance (facultatif)">
          <TextInput value={o.message} onChange={(message) => set({ message })} max={60} placeholder="Tout finit par s'équilibrer." />
        </Field>
        <p className="font-body text-xs text-paper/60">
          {ctx.target} rééquilibre la balance en retirant des étoiles du plateau le plus lourd (un clic par étoile).
        </p>
      </div>
      <Preview who={ctx.target} className="h-48 bg-[#0b0d26]">
        <div className="absolute inset-0 transition-transform duration-700" style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "50% 40%" }}>
          <MiniPage />
        </div>
        {o.constellation && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 opacity-30">
            <VaryexisSign />
          </div>
        )}
        <div className="absolute bottom-1 left-1/2 w-32 -translate-x-1/2">
          <BalanceArt left={1} right={4} angle={12} />
          {o.message && <p className="truncate text-center font-body text-[9px] italic text-[#fff4d6]">« {o.message} »</p>}
        </div>
      </Preview>
    </div>
  );
}

function AbyssPanel({ value: o, onChange, ctx }: Props<"abysses">) {
  const set = (p: Partial<TrollOptions["abysses"]>) => onChange({ ...o, ...p });
  const dark = [0, 0.35, 0.55, 0.78][o.darkness];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Vitesse de la chute">
          <Seg value={o.speed} onChange={(s) => set({ speed: s as AbyssSpeed })} accent={ctx.accent} options={(Object.keys(ABYSS_SPEEDS) as AbyssSpeed[]).map((k) => ({ v: k, label: ABYSS_SPEEDS[k].label }))} />
        </Field>
        <Field label="Profondeur (obscurité)">
          <Seg value={o.darkness} onChange={(darkness) => set({ darkness })} accent={ctx.accent} options={[{ v: 1, label: "Lagon" }, { v: 2, label: "Abysses" }, { v: 3, label: "Fosse" }]} />
        </Field>
        <Toggle checked={o.invert} onChange={(invert) => set({ invert })} accent={ctx.accent} label="Molette inversée (descendre fait monter)" />
        <Toggle checked={o.creatures} onChange={(creatures) => set({ creatures })} accent={ctx.accent} label="Créatures des profondeurs 🐙" />
      </div>
      <Preview who={ctx.target} className="bg-ink">
        <div className="troll-preview-sink" style={{ animationDuration: `${{ lent: 9, moyen: 6, rapide: 3.5 }[o.speed]}s` }}>
          <MiniPage />
          <MiniPage title="Plus bas…" lines={["Encore plus bas", "Glou", "Glou glou"]} />
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to bottom, rgb(10 60 90 / ${dark * 0.4}), rgb(3 10 40 / ${dark}))` }} />
        {o.creatures && (
          <>
            <span className="troll-preview-fish absolute top-[30%] text-2xl">🐙</span>
            <span className="troll-preview-fish absolute top-[62%] text-xl" style={{ animationDelay: "-3s", animationDirection: "reverse" }}>🐟</span>
          </>
        )}
        {o.invert && <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-paper/80">🖱 inversée</span>}
      </Preview>
    </div>
  );
}

function BailiffPanel({ value: o, onChange, ctx }: Props<"huissier">) {
  const set = (p: Partial<TrollOptions["huissier"]>) => onChange({ ...o, ...p });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Ton de l'avis">
          <Seg value={o.tone} onChange={(t) => set({ tone: t as BailiffTone })} accent={ctx.accent} options={(Object.keys(BAILIFF_TONES) as BailiffTone[]).map((k) => ({ v: k, label: BAILIFF_TONES[k].label }))} />
        </Field>
        <Field label="Ce qui est saisi (facultatif)">
          <TextInput value={o.items} onChange={(items) => set({ items })} max={160} placeholder={BAILIFF_DEFAULT_ITEMS} />
        </Field>
        <Field label="Tampon">
          <Seg value={o.word} onChange={(word) => set({ word })} accent={ctx.accent} options={BAILIFF_WORDS.map((w) => ({ v: w as string, label: w }))} />
        </Field>
        <Field label="Un tampon toutes les">
          <Slider value={o.every} min={1} max={6} onChange={(every) => set({ every })} accent={ctx.accent} unit=" s" />
        </Field>
      </div>
      <Preview who={ctx.target} className="bg-black/70 p-3">
        <div className="troll-contract relative space-y-2 rounded-lg p-4 text-paper-text">
          <p className="text-center font-display text-lg uppercase tracking-wide text-[#7a1d14]">{BAILIFF_TONES[o.tone].title}</p>
          <div className="space-y-1.5 text-[12px] [&_p]:text-[12px]">
            <BailiffText tone={o.tone} actor={ctx.me} nickname={ctx.target} items={o.items || BAILIFF_DEFAULT_ITEMS} word={o.word} />
          </div>
          <span className="troll-saisi !text-xl" style={{ "--rot": "-12deg", top: "62%", left: "70%" } as CSSProperties}>{o.word}</span>
        </div>
      </Preview>
    </div>
  );
}

function FlatteryPanel({ value: o, onChange, ctx }: Props<"flatterie">) {
  const set = (p: Partial<TrollOptions["flatterie"]>) => onChange({ ...o, ...p });
  const msgs = ["Salut tout le monde !", "Quelqu'un pour un raid ?", "J'ai fini ma quête."];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label={`Compliment (après « … et ${ctx.me} »)`}>
          <TextInput value={o.phrase === FLATTERY_DEFAULT ? "" : o.phrase} onChange={(phrase) => set({ phrase: phrase || FLATTERY_DEFAULT })} max={60} placeholder={FLATTERY_DEFAULT} />
        </Field>
        <Field label="Couleur">
          <div className="flex gap-2">
            {FLATTERY_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                onClick={() => set({ color: c.hex })}
                className={`h-8 w-8 rounded-full border-2 transition ${o.color === c.hex ? "scale-110 border-paper" : "border-transparent opacity-70"}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </Field>
        <Field label="Fréquence">
          <Seg value={o.every} onChange={(every) => set({ every })} accent={ctx.accent} options={[{ v: 1, label: "Chaque message" }, { v: 2, label: "1 sur 2" }, { v: 3, label: "1 sur 3" }]} />
        </Field>
      </div>
      <Preview who="tout le monde, dans la messagerie" className="space-y-2 bg-ink p-3">
        {msgs.map((m, i) => (
          <div key={i} className="max-w-[90%] rounded-xl rounded-bl-sm border border-white/10 bg-white/5 px-3 py-2">
            <p className="font-mono text-[10px] text-paper/50">{ctx.target}</p>
            <p className="font-body text-sm text-paper">
              {m}
              {(o.every === 1 || i % o.every === 0) && (
                <span className="ml-1 font-bold" style={{ color: o.color }}>
                  … et {ctx.me} {o.phrase || FLATTERY_DEFAULT} 🎭
                </span>
              )}
            </p>
          </div>
        ))}
      </Preview>
    </div>
  );
}

function MirrorPanel({ value: o, onChange, ctx }: Props<"miroir">) {
  const set = (p: Partial<TrollOptions["miroir"]>) => onChange({ ...o, ...p });
  const [flip, setFlip] = useState(false);
  const flipT = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(flipT.current), []);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Effet" hint={MIRROR_MODES[o.mode].hint}>
          <Seg value={o.mode} onChange={(m) => set({ mode: m as MirrorMode })} accent={ctx.accent} options={(Object.keys(MIRROR_MODES) as MirrorMode[]).map((k) => ({ v: k, label: MIRROR_MODES[k].label }))} />
        </Field>
        <Field label="Retournement toutes les">
          <Slider value={o.every} min={20} max={180} step={10} onChange={(every) => set({ every })} accent={ctx.accent} format={(n) => (n < 60 ? `${n} s` : `${Math.floor(n / 60)} min ${n % 60 ? `${n % 60} s` : ""}`)} />
        </Field>
        <button
          type="button"
          onClick={() => {
            setFlip(true);
            clearTimeout(flipT.current);
            flipT.current = setTimeout(() => setFlip(false), 2800);
          }}
          className="rounded-lg border border-white/20 px-3 py-1.5 font-mono text-xs text-paper/80 hover:bg-white/10"
        >
          ↻ Voir le retournement
        </button>
      </div>
      <Preview who={ctx.target} className="bg-ink p-4">
        <div className={`troll-preview-mirror troll-mirror-${o.mode} ${flip ? "troll-flip" : ""} rounded-lg border border-white/10 bg-black/20`}>
          <MiniPage title="Dossier" lines={["Tes quêtes", "Classement", "Boutique"]} />
        </div>
      </Preview>
    </div>
  );
}

const REWRITE_SAMPLE = "Bienvenue au S.I.D. ! Termine tes quêtes pour gagner des zénis, puis passe à la boutique et consulte le classement.";

function RewritePanel({ value: o, onChange, ctx }: Props<"reecriture">) {
  const set = (p: Partial<TrollOptions["reecriture"]>) => onChange({ ...o, ...p });
  const rewrite = useMemo(() => makeRewriter(o.theme, o.custom), [o.theme, o.custom]);
  const rows: [string, string][] = [...o.custom, ...(o.custom.length < 6 ? [["", ""] as [string, string]] : [])];
  const setRow = (i: number, k: 0 | 1, v: string) => {
    const next = rows.map((r) => [...r] as [string, string]);
    next[i][k] = v.slice(0, 30);
    set({ custom: next.filter(([a, b]) => a.trim() || b.trim()).slice(0, 6) });
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Lexique">
          <Seg value={o.theme} onChange={(t) => set({ theme: t as RewriteTheme })} accent={ctx.accent} options={(Object.keys(REWRITE_THEMES) as RewriteTheme[]).map((k) => ({ v: k, label: `${REWRITE_THEMES[k].emoji} ${REWRITE_THEMES[k].label}` }))} />
        </Field>
        <Field label="Tes propres mots (6 au plus)" hint="Ils passent avant le lexique. Un mot exact, sans majuscule obligatoire.">
          <div className="space-y-1.5">
            {rows.map(([a, b], i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={a} onChange={(e) => setRow(i, 0, e.target.value)} placeholder="mot du site" className="w-full min-w-0 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 font-body text-sm text-paper outline-none placeholder:text-paper/30" />
                <span className="text-paper/40">→</span>
                <input value={b} onChange={(e) => setRow(i, 1, e.target.value)} placeholder="devient" className="w-full min-w-0 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 font-body text-sm text-paper outline-none placeholder:text-paper/30" />
              </div>
            ))}
          </div>
        </Field>
      </div>
      <Preview who={ctx.target} className="space-y-2 bg-ink p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-paper/40">Avant</p>
        <p className="font-body text-sm text-paper/50 line-through decoration-white/20">{REWRITE_SAMPLE}</p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-paper/40">Après</p>
        <p className="font-body text-sm text-paper">{rewrite(REWRITE_SAMPLE)}</p>
      </Preview>
    </div>
  );
}

function RationPanel({ value: o, onChange, ctx }: Props<"rationnement">) {
  const set = (p: Partial<TrollOptions["rationnement"]>) => onChange({ ...o, ...p });
  const [last, setLast] = useState(0);
  const [count, setCount] = useState(0);
  const [nowT, setNowT] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowT(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const wait = Math.max(0, o.interval * 1000 - (nowT - last));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Un clic toutes les">
          <Slider value={o.interval} min={3} max={15} onChange={(interval) => set({ interval })} accent={ctx.accent} unit=" s" />
        </Field>
        <Toggle checked={o.keys} onChange={(keys) => set({ keys })} accent={ctx.accent} label="Le clavier aussi (une touche = un clic : écrire devient très, très long)" />
      </div>
      <Preview who={ctx.target} className="flex flex-col items-center justify-center gap-3 bg-ink p-6">
        <p className="font-body text-xs text-paper/60">Essaie : clique vite.</p>
        <button
          type="button"
          onClick={() => {
            if (Date.now() - last < o.interval * 1000) return;
            setLast(Date.now());
            setCount((c) => c + 1);
          }}
          className={`rounded-lg px-5 py-2 font-display uppercase tracking-wide text-ink transition ${wait > 0 ? "opacity-40" : ""}`}
          style={{ background: ctx.accent }}
        >
          Cliquer ({count})
        </button>
        <p className={`rounded-full px-3 py-1 font-mono text-xs text-white ${wait > 0 ? "bg-[#5b2fc9]" : "bg-transparent"}`}>{wait > 0 ? `🎵 Tic… tac… encore ${Math.ceil(wait / 1000)} s` : " "}</p>
      </Preview>
    </div>
  );
}

function ContractPanel({ value: o, onChange, ctx }: Props<"avenant">) {
  const set = (p: Partial<TrollOptions["avenant"]>) => onChange({ ...o, ...p });
  const rows = [...o.clauses, ...(o.clauses.length < 3 ? [""] : [])];
  const setRow = (i: number, v: string) => {
    const next = [...rows];
    next[i] = v.slice(0, 140);
    set({ clauses: next.filter((c) => c.trim()).slice(0, 3) });
  };
  const [dodged, setDodged] = useState(0);
  const [pos, setPos] = useState(0);
  useEffect(() => setDodged(0), [o.dodges]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Tes clauses (3 au plus, en tête du contrat)">
          <div className="space-y-1.5">
            {rows.map((c, i) => (
              <textarea
                key={i}
                value={c}
                rows={2}
                maxLength={140}
                onChange={(e) => setRow(i, e.target.value)}
                placeholder={i === 0 ? `Le soussigné offre un croissant à ${ctx.me} chaque matin.` : "Clause suivante…"}
                className="w-full resize-none rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-body text-sm text-paper outline-none placeholder:text-paper/30"
              />
            ))}
          </div>
        </Field>
        <Field label="La case s'enfuit">
          <Slider value={o.dodges} min={0} max={5} onChange={(dodges) => set({ dodges })} accent={ctx.accent} format={(n) => (n ? `${n} fois` : "jamais")} />
        </Field>
        <Toggle checked={o.signature} onChange={(signature) => set({ signature })} accent={ctx.accent} label={`Signature recopiée : « Lu et approuvé, ${ctx.me} a toujours raison »`} />
      </div>
      <Preview who={ctx.target} className="bg-black/70 p-3">
        <div className="troll-contract space-y-2 rounded-lg p-4 text-paper-text">
          <p className="text-center font-display text-base uppercase tracking-wide">À lire et signer</p>
          <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-paper-text/20 bg-white/40 p-2 font-body text-[11px] leading-snug">
            {o.clauses.map((c, i) => (
              <p key={i}>
                <strong>Article {i + 1}.</strong> Clause particulière de {ctx.me} : {c}
              </p>
            ))}
            <p>
              <strong>Article {o.clauses.length + 1}.</strong> Le soussigné, {ctx.target}, reconnaît que {ctx.me} a toujours raison…
            </p>
          </div>
          <div className="flex h-8 items-center justify-center">
            <label
              className="flex items-center gap-2 font-mono text-[11px] transition-transform duration-200"
              style={{ transform: `translateX(${pos}px)` }}
              onPointerEnter={() => {
                if (dodged < o.dodges) {
                  setDodged((d) => d + 1);
                  setPos((Math.random() - 0.5) * 140);
                }
              }}
            >
              <input type="checkbox" className="h-3.5 w-3.5 accent-[#7a1d14]" readOnly checked={dodged >= o.dodges && dodged > 0} />
              J&apos;accepte sans réserve
            </label>
          </div>
          {o.signature && <p className="border-b border-dashed border-paper-text/40 pb-0.5 font-body text-[11px] italic text-paper-text/50">Lu et approuvé, {ctx.me} a toujours raison</p>}
        </div>
      </Preview>
    </div>
  );
}

function DragonPanel({ value: o, onChange, ctx }: Props<"defi_dragon">) {
  const set = (p: Partial<TrollOptions["defi_dragon"]>) => onChange({ ...o, ...p });
  const [search, setSearch] = useState("");
  const pool = ctx.members.filter((m) => m.id !== ctx.targetId);
  const shown = pool.filter((m) => !o.players.includes(m.id) && m.nickname.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const prices = ctx.prices ?? ARENA_PRICES;
  const cost = arenaCost(o, prices);
  const short = cost > ctx.balance;
  const name = (id: string) => ctx.members.find((m) => m.id === id)?.nickname ?? "?";
  useEffect(() => {
    if (ctx.targetId && o.players.includes(ctx.targetId)) set({ players: o.players.filter((p) => p !== ctx.targetId) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.targetId]);
  const steps = [
    { t: "Convocation", d: `${[ctx.target, ...o.players.map(name)].join(", ")} : entrer dans l'arène ou fuir.` },
    { t: "Entrée", d: "Cinématique : tu fonds sur l'arène, rugissement." },
    { t: "Combat · 2 min 30", d: "Toi en dragon (feu, morsure, rugissement) contre leurs éclairs et leurs boucliers." },
    { t: "Fin", d: o.finale ? `${DRAGON_FINALES[o.finale].label} du dernier joueur si tu gagnes ; chute du dragon sinon.` : "Victoire ou chute du dragon." },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Ta forme">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DRAGON_SKINS) as DragonSkin[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set({ skin: k })}
                  className={`rounded-xl border p-2 text-center transition ${o.skin === k ? "bg-white/10" : "border-white/10 hover:bg-white/5"}`}
                  style={o.skin === k ? { borderColor: ctx.accent } : undefined}
                >
                  <span className="block text-2xl">{DRAGON_SKINS[k].emoji}</span>
                  <span className="block font-display text-xs uppercase tracking-wide">{DRAGON_SKINS[k].label}</span>
                  <span className="block font-body text-[10px] leading-tight text-paper/50">{DRAGON_SKINS[k].hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Joueurs en plus de ${ctx.target} · +${zenis(prices.extraPlayer)} chacun (${prices.maxExtra} au plus)`}>
            <div className="flex flex-wrap gap-1.5">
              {o.players.map((id) => (
                <button key={id} type="button" onClick={() => set({ players: o.players.filter((p) => p !== id) })} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-xs text-paper hover:border-red hover:text-red">
                  {name(id)} ✕
                </button>
              ))}
              {o.players.length === 0 && <span className="font-body text-xs text-paper/40">Personne d&apos;autre pour l&apos;instant.</span>}
            </div>
            {o.players.length < prices.maxExtra && (
              <div className="space-y-1.5">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ajouter un joueur…" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 font-body text-sm text-paper outline-none placeholder:text-paper/30" />
                {search && (
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          set({ players: [...o.players, m.id].slice(0, prices.maxExtra) });
                          setSearch("");
                        }}
                        className="rounded-full border border-white/15 px-2.5 py-1 font-mono text-xs text-paper/80 hover:bg-white/10"
                      >
                        + {m.nickname}
                      </button>
                    ))}
                    {!shown.length && <span className="font-body text-xs text-paper/40">Aucun membre trouvé.</span>}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Toggle
            checked={o.spectators}
            onChange={(spectators) => set({ spectators })}
            accent={ctx.accent}
            label={<span>📣 Tout le S.I.D. en tribune, caméra de bataille · <strong>+{zenis(prices.spectators)}</strong></span>}
          />

          <Field label={`Cinématique de fin · +${zenis(prices.finale)}`}>
            <Seg
              value={o.finale ?? "none"}
              onChange={(f) => set({ finale: f === "none" ? null : (f as DragonFinale) })}
              accent={ctx.accent}
              options={[{ v: "none", label: "Aucune" }, ...(Object.keys(DRAGON_FINALES) as DragonFinale[]).map((k) => ({ v: k, label: `${DRAGON_FINALES[k].emoji} ${DRAGON_FINALES[k].label}`, title: DRAGON_FINALES[k].hint }))]}
            />
          </Field>
        </div>

        <div className="space-y-3">
          <Preview who={`${ctx.target}${o.players.length ? ` et ${o.players.length} autre${o.players.length > 1 ? "s" : ""}` : ""}`} className="dragon-preview">
            <div className="dragon-duel-sky absolute inset-0" />
            <div className="relative space-y-2 p-4">
              <div className="mx-auto w-2/3">
                <DragonSvg breathing={!!o.finale} />
              </div>
              <ol className="space-y-1.5">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-2 font-body text-[12px] text-paper/85">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-ink" style={{ background: ctx.accent }}>
                      {i + 1}
                    </span>
                    <span>
                      <strong className="font-display uppercase tracking-wide">{s.t}</strong> — {s.d}
                    </span>
                  </li>
                ))}
              </ol>
              {o.spectators && <p className="font-mono text-[10px] text-[#ffb15c]">📣 Les autres membres reçoivent une convocation en tribune.</p>}
            </div>
          </Preview>

          <div className={`space-y-1 rounded-lg border p-3 font-mono text-xs ${short ? "border-red/50 bg-red/10" : "border-white/10 bg-black/20"}`}>
            <div className="flex justify-between text-paper/70">
              <span>Défi de base</span>
              <span>gratuit</span>
            </div>
            {o.players.length > 0 && (
              <div className="flex justify-between text-paper/70">
                <span>{o.players.length} joueur{o.players.length > 1 ? "s" : ""} en plus</span>
                <span>{zenis(o.players.length * prices.extraPlayer)}</span>
              </div>
            )}
            {o.spectators && (
              <div className="flex justify-between text-paper/70">
                <span>Tribune</span>
                <span>{zenis(prices.spectators)}</span>
              </div>
            )}
            {o.finale && (
              <div className="flex justify-between text-paper/70">
                <span>{DRAGON_FINALES[o.finale].label}</span>
                <span>{zenis(prices.finale)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-1 text-paper">
              <span>Total</span>
              <span>{cost ? zenis(cost) : "0 z"}</span>
            </div>
            <p className={short ? "text-red" : "text-paper/40"}>
              Ton solde : {zenis(ctx.balance)}
              {short ? " — pas assez pour ces options." : ""}
            </p>
            <p className="text-[10px] text-paper/40">Remboursé si personne n&apos;entre dans l&apos;arène.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Aiguillage
   --------------------------------------------------------------- */

export function TrollOptionsEditor({
  power,
  value,
  onChange,
  ctx,
  everyone = false,
}: {
  power: TrollPower;
  value: TrollOptions[TrollPower];
  onChange: (v: TrollOptions[TrollPower]) => void;
  ctx: Ctx;
  everyone?: boolean;
}) {
  // Chaque panneau reçoit ses propres options ; le cast reste local à l'aiguillage.
  const p = { value, onChange, ctx } as never;
  switch (power) {
    case "calcul":
      return <CalcPanel {...(p as Props<"calcul">)} />;
    case "hantise":
      return <HauntPanel {...(p as Props<"hantise">)} />;
    case "fete":
      return <PartyPanel {...(p as Props<"fete">)} everyone={everyone} />;
    case "abysses":
      return <AbyssPanel {...(p as Props<"abysses">)} />;
    case "huissier":
      return <BailiffPanel {...(p as Props<"huissier">)} />;
    case "flatterie":
      return <FlatteryPanel {...(p as Props<"flatterie">)} />;
    case "miroir":
      return <MirrorPanel {...(p as Props<"miroir">)} />;
    case "reecriture":
      return <RewritePanel {...(p as Props<"reecriture">)} />;
    case "rationnement":
      return <RationPanel {...(p as Props<"rationnement">)} />;
    case "avenant":
      return <ContractPanel {...(p as Props<"avenant">)} />;
    case "defi_dragon":
      return <DragonPanel {...(p as Props<"defi_dragon">)} />;
    case "nuee":
      return <NueePanel {...(p as Props<"nuee">)} />;
    case "blizzard":
      return <BlizzardPanel {...(p as Props<"blizzard">)} />;
    case "coup_de_foudre":
      return <LovePanel {...(p as Props<"coup_de_foudre">)} />;
    case "poisson":
      return <FoolsPanel {...(p as Props<"poisson">)} />;
    case "cloches":
      return <BellsPanel {...(p as Props<"cloches">)} />;
    case "greve":
      return <StrikePanel {...(p as Props<"greve">)} />;
    case "fanfare":
      return <FanfarePanel {...(p as Props<"fanfare">)} />;
    case "artifice":
      return <FireworksPanel {...(p as Props<"artifice">)} />;
    case "treve":
      return <TrucePanel {...(p as Props<"treve">)} />;
    case "assaut":
      return <AssautPanel {...(p as Props<"assaut">)} />;
    case "balance":
      return <BalancePanel {...(p as Props<"balance">)} />;
    default:
      return null;
  }
}

export type { Ctx as TrollOptionsContext };
