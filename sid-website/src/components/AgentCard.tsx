"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Profile } from "@/types/database";
import { RANK_INFO } from "@/components/RankCard";
import { TITLE_BY_ID, titleLabel, type TitleId } from "@/lib/titles";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Carte d'agent (Lot 60) : une carte d'identité du S.I.D. dessinée dans le
 * navigateur (photo, nom de code, rang, titre, renommée, puissance,
 * matricule), à télécharger en PNG ou à partager. Rien n'est envoyé nulle part.
 */

const W = 1200;
const H = 720;

/** Matricule stable tiré de l'identifiant (SID-XXXX-XXXX). */
function matricule(id: string) {
  const hex = id.replace(/-/g, "").toUpperCase();
  return `SID-${hex.slice(0, 4)}-${hex.slice(-4)}`;
}

function loadImage(src: string, cors: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Papier kraft légèrement taché, toujours le même pour un agent. */
function paper(ctx: CanvasRenderingContext2D, seed: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#efe5c9");
  g.addColorStop(1, "#d9c9a2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  let s = seed || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(90, 70, 40, ${rnd() * 0.06})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
  }
  for (let i = 0; i < 3; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 60 + rnd() * 120;
    const t = ctx.createRadialGradient(x, y, 0, x, y, r);
    t.addColorStop(0, "rgba(150, 110, 60, 0.07)");
    t.addColorStop(1, "rgba(150, 110, 60, 0)");
    ctx.fillStyle = t;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function field(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, size = 46, maxW = 640) {
  ctx.fillStyle = "#6b5a3e";
  ctx.font = '500 17px "JetBrains Mono", monospace';
  ctx.fillText(label.toUpperCase().split("").join(" "), x, y);
  ctx.fillStyle = "#262a38";
  let s = size;
  do {
    ctx.font = `600 ${s}px Oswald, Impact, sans-serif`;
    s -= 2;
  } while (ctx.measureText(value).width > maxW && s > 20);
  ctx.fillText(value, x, y + size * 0.95 + 6);
}

type Data = { profile: Profile; title: { id: TitleId; level: number } | null; reputation: number };

async function draw(canvas: HTMLCanvasElement, { profile, title, reputation }: Data, withPhoto: boolean) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;
  const seed = parseInt(profile.id.replace(/-/g, "").slice(0, 8), 16);
  await Promise.allSettled([
    document.fonts.load('600 46px Oswald'),
    document.fonts.load('500 17px "JetBrains Mono"'),
    document.fonts.load('italic 400 40px "Source Serif 4"'),
  ]);

  // Coins arrondis + papier
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 34);
  ctx.clip();
  paper(ctx, seed);

  // Bandeau du haut
  ctx.fillStyle = "#262a38";
  ctx.fillRect(0, 0, W, 112);
  ctx.fillStyle = "#d99a9a";
  ctx.fillRect(0, 112, W, 6);
  try {
    const logo = await loadImage("/logo.webp", false);
    ctx.save();
    ctx.beginPath();
    ctx.arc(86, 56, 38, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, 48, 18, 76, 76);
    ctx.restore();
  } catch {
    /* sans logo */
  }
  ctx.fillStyle = "#ede6d3";
  ctx.font = '700 44px Oswald, Impact, sans-serif';
  ctx.fillText("S.I.D.", 144, 66);
  ctx.fillStyle = "#8fb3d9";
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText("C A R T E   D ' A G E N T", 146, 94);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(237, 230, 211, 0.75)";
  ctx.fillText(matricule(profile.id), W - 56, 66);
  ctx.textAlign = "left";

  // Photo
  const px = 60;
  const py = 160;
  const pw = 300;
  const ph = 380;
  ctx.fillStyle = "#c9b98f";
  ctx.fillRect(px - 8, py - 8, pw + 16, ph + 16);
  ctx.fillStyle = "#3a3f52";
  ctx.fillRect(px, py, pw, ph);
  let drew = false;
  if (withPhoto && profile.avatar_url) {
    try {
      const img = await loadImage(profile.avatar_url, true);
      const r = Math.max(pw / img.width, ph / img.height);
      const iw = img.width * r;
      const ih = img.height * r;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      ctx.filter = "sepia(0.25) contrast(1.05)";
      ctx.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
      ctx.restore();
      drew = true;
    } catch {
      /* photo inaccessible : initiale */
    }
  }
  if (!drew) {
    ctx.fillStyle = "#ede6d3";
    ctx.font = '700 170px Oswald, Impact, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText((profile.nickname || "?").charAt(0).toUpperCase(), px + pw / 2, py + ph / 2 + 60);
    ctx.textAlign = "left";
  }
  // Trombone
  ctx.strokeStyle = "#8d8f99";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(px + pw - 70, py - 30, 30, 90, 15);
  ctx.stroke();

  // Champs
  const fx = 420;
  const rank = profile.member_rank ?? "E";
  field(ctx, fx, 190, "Nom de code", profile.nickname, 64);
  field(ctx, fx, 300, "Rang", `${RANK_INFO[rank]?.letter ?? rank} — ${RANK_INFO[rank]?.title ?? ""}`);
  field(ctx, fx, 390, "Titre", title && TITLE_BY_ID[title.id] ? titleLabel(title.id, title.level) : "—");
  field(ctx, fx, 480, "Renommée", `${reputation.toLocaleString("fr-FR")} pts`, 40, 280);
  field(ctx, fx + 320, 480, "Puissance", Math.round(Number(profile.power_score ?? 0)).toLocaleString("fr-FR"), 40, 280);
  field(
    ctx,
    fx,
    570,
    "Agent depuis",
    new Date(profile.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    34,
  );

  // Code-barres tiré de l'identifiant
  const bits = profile.id.replace(/-/g, "");
  let bx = 60;
  ctx.fillStyle = "#262a38";
  for (const ch of bits) {
    const v = parseInt(ch, 16);
    const w = 2 + (v % 4);
    ctx.fillRect(bx, 590, w, 70);
    bx += w + 2 + (v >> 2);
    if (bx > 360) break;
  }

  // Signature
  ctx.strokeStyle = "rgba(38, 42, 56, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(fx, 660);
  ctx.lineTo(fx + 360, 660);
  ctx.stroke();
  ctx.fillStyle = "#2b3a6b";
  ctx.font = 'italic 400 40px "Source Serif 4", Georgia, serif';
  ctx.save();
  ctx.translate(fx + 10, 652);
  ctx.rotate(-0.04);
  ctx.fillText(profile.nickname, 0, 0);
  ctx.restore();

  // Tampon
  ctx.save();
  ctx.translate(1010, 610);
  ctx.rotate(-0.22);
  const stamp = profile.is_founder ? "FONDATEUR" : "ACCÈS AUTORISÉ";
  ctx.strokeStyle = "rgba(178, 54, 44, 0.8)";
  ctx.fillStyle = "rgba(178, 54, 44, 0.85)";
  ctx.lineWidth = 5;
  ctx.font = '700 34px Oswald, Impact, sans-serif';
  const sw = ctx.measureText(stamp).width + 44;
  ctx.strokeRect(-sw / 2, -34, sw, 68);
  ctx.lineWidth = 2;
  ctx.strokeRect(-sw / 2 + 7, -27, sw - 14, 54);
  ctx.textAlign = "center";
  ctx.fillText(stamp, 0, 12);
  ctx.restore();

  ctx.restore();
}

export function AgentCardButton(props: Data) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs uppercase tracking-wide text-paper/80 hover:border-blue/50 hover:text-paper"
      >
        <SidIcon name="idcard" /> Ma carte d&apos;agent
      </button>
      {open && <AgentCardDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function AgentCardDialog({ onClose, ...data }: Data & { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = canvas.current!;
      await draw(c, data, true);
      let b: Blob | null = null;
      try {
        b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      } catch {
        // Photo d'un autre site qui bloque l'export : carte refaite avec l'initiale.
        await draw(c, data, false);
        b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
        if (alive) setNote("Ta photo n'a pas pu être reprise : l'initiale la remplace.");
      }
      if (!alive || !b) return;
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      const file = new File([b], "carte.png", { type: "image/png" });
      setCanShare(!!navigator.canShare?.({ files: [file] }));
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const fileName = `carte-agent-${data.profile.nickname.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;

  async function share() {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title: "Ma carte d'agent du S.I.D." });
    } catch {
      /* partage annulé */
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ma carte d'agent"
        className="glass-card w-full max-w-3xl space-y-4 p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl uppercase tracking-wide">Ma carte d&apos;agent</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded px-2 text-paper/70 hover:text-paper">
            ✕
          </button>
        </div>
        <canvas ref={canvas} className="hidden" />
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Carte d'agent de ${data.profile.nickname}`} className="agent-card-img w-full rounded-2xl" />
        ) : (
          <div className="flex aspect-[5/3] w-full items-center justify-center rounded-2xl bg-white/5 font-mono text-xs text-paper/70">Impression de la carte…</div>
        )}
        {note && <p className="font-body text-xs text-paper/70">{note}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {canShare && (
            <button type="button" onClick={share} disabled={!blob} className="rounded-lg border border-white/20 px-4 py-2 font-mono text-xs uppercase hover:border-blue">
              Partager
            </button>
          )}
          <a
            href={url ?? undefined}
            download={fileName}
            aria-disabled={!url}
            className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            Télécharger (PNG)
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
