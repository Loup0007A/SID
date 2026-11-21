"use client";

import Link from "next/link";
import { useState } from "react";
import { useTuto } from "@/components/tuto/TutoProvider";
import { SidIcon } from "@/components/icons/SidIcon";
import { SettingCard, Status, Toggle } from "./ui";

/** Réglages → Guide et astuces (Lot 93). */
export function GuideSettings() {
  const tuto = useTuto();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const data = tuto?.data;

  return (
    <div className="space-y-5">
      <SettingCard icon="bulb" title="Astuces de première visite" intro="La petite fiche qui explique chaque page la première fois que tu l'ouvres.">
        {!tuto || !data ? (
          <p className="text-sm opacity-70">Chargement…</p>
        ) : (
          <>
            <Toggle
              checked={!data.tips_disabled}
              onChange={(on) => {
                tuto.setTipsDisabled(!on);
                setMsg({ ok: true, text: on ? "Astuces affichées." : "Astuces masquées." });
              }}
              label="Afficher les astuces"
              hint={`${data.tips_seen.length} astuce${data.tips_seen.length > 1 ? "s" : ""} déjà lue${data.tips_seen.length > 1 ? "s" : ""}.`}
            />
            <button
              onClick={() => {
                tuto.resetTips();
                setMsg({ ok: true, text: "Chaque page te remontrera son astuce." });
              }}
              disabled={data.tips_seen.length === 0}
              className="btn-contour"
            >
              Revoir toutes les astuces
            </button>
          </>
        )}
        <Status msg={msg} />
      </SettingCard>

      <SettingCard icon="compass" title="Visite guidée" intro="Le tour du Dossier en cinq minutes, page après page.">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => tuto?.startTour()} disabled={!tuto} className="bg-blue rounded-xl px-4 py-2 font-display text-sm uppercase text-ink disabled:opacity-40">
            Relancer la visite
          </button>
          <Link href="/dashboard/guide" className="btn-contour">
            <SidIcon name="book" /> Ouvrir le Guide du S.I.D.
          </Link>
        </div>
      </SettingCard>
    </div>
  );
}
