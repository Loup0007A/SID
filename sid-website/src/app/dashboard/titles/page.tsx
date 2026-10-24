"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import { EVENTS, EVENT_TITLES, POWERS, SECRET_TITLES, TITLES, TITLE_BY_ID, isTitleId, roman, type TitleDef, type TitleId, TITLES_CHANGED_EVENT } from "@/lib/titles";
import { useSiteDecor } from "@/components/seasonal/siteDecor";
import { TitleAuraLayer, TitleBadge, titleStyle } from "@/components/titles/TitleVisuals";
import { TrollPanel, type TrollStatus } from "@/components/titles/TrollPanel";
import { SidIcon } from "@/components/icons/SidIcon";

type Owned = { title_id: TitleId; level: number; obtained_at: string };

function TitlesInner() {
  const supabase = createClient();
  const params = useSearchParams();
  const [me, setMe] = useState<{ id: string; nickname: string; equipped: TitleId | null } | null>(null);
  const [owned, setOwned] = useState<Map<TitleId, Owned>>(new Map());
  const [holders, setHolders] = useState<Map<string, number>>(new Map());
  const [status, setStatus] = useState<TrollStatus | null>(null);
  const [dragon, setDragon] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decor = useSiteDecor();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await currentUser();
    if (!user) return;
    const [{ data: prof }, { data: mine, error: e1 }, { data: counts }, { data: st }, { data: eq }] = await Promise.all([
      supabase.from("profiles").select("id, nickname, equipped_title").eq("id", user.id).single(),
      supabase.from("user_titles").select("title_id, level, obtained_at").eq("user_id", user.id),
      supabase.rpc("title_holder_counts"),
      supabase.rpc("troll_status"),
      supabase.rpc("list_equipped_titles", { p_user_ids: [user.id] }),
    ]);
    if (e1) {
      setError("Les titres ne sont pas encore activés : la migration 0061 doit être lancée.");
      return;
    }
    setMe({ id: user.id, nickname: prof?.nickname ?? "", equipped: isTitleId(prof?.equipped_title) ? prof!.equipped_title : null });
    setOwned(new Map(((mine ?? []) as Owned[]).filter((o) => isTitleId(o.title_id)).map((o) => [o.title_id, o])));
    setHolders(new Map(((counts ?? []) as { title_id: string; holders: number }[]).map((c) => [c.title_id, Number(c.holders)])));
    setStatus((st as TrollStatus) ?? null);
    setDragon(!!((eq ?? []) as { dragon: boolean }[])[0]?.dragon);
  }, [supabase]);

  useEffect(() => {
    load();
    const again = () => load();
    window.addEventListener(TITLES_CHANGED_EVENT, again);
    return () => window.removeEventListener(TITLES_CHANGED_EVENT, again);
  }, [load]);

  async function equip(id: TitleId | null) {
    setBusy(id ?? "none");
    const { error } = await supabase.rpc("equip_title", { p_title: id });
    setBusy(null);
    if (error) setError(error.message);
    else load();
  }

  if (error) return <p className="font-body text-paper/70">{error}</p>;
  if (!me || !status) return <p className="font-body text-paper/60">Ouverture de la vitrine…</p>;

  const equipped = me.equipped ? TITLE_BY_ID[me.equipped] : null;
  const ownedCount = owned.size;
  const equippedId = me.equipped;

  function card(t: TitleDef) {
    const o = owned.get(t.id);
    const n = holders.get(t.id) ?? 0;
    const isEquipped = equippedId === t.id;
    if (!o) {
      return (
        <div key={t.id} className="glass-card title-locked relative space-y-2 overflow-hidden p-5">
          <EventRibbon t={t} />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/40 font-display text-xl text-paper/30">?</span>
            <div>
              <p className="font-display text-lg uppercase tracking-wide text-paper/40">{t.event ? `Titre de ${EVENTS[t.event].name}` : "Titre secret"}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-paper/35">
                {n === 0 ? "Personne ne l'a encore trouvé" : `${n} porteur${n > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <p className="font-body text-sm italic text-paper/60">« {t.riddle} »</p>
            {t.event && (
              <p className={`font-mono text-[10px] uppercase tracking-wide ${decor?.[t.event] ? "text-[#9fe3cf]" : "text-paper/40"}`}>
                {decor?.[t.event] ? (
                  <>
                    <SidIcon name={EVENTS[t.event].icon} /> À chercher maintenant, pendant {EVENTS[t.event].name}
                  </>
                ) : (
                  `Revient à ${EVENTS[t.event].name} (${EVENTS[t.event].period})`
                )}
              </p>
            )}
        </div>
      );
    }
    return (
      <div key={t.id} className="glass-card relative min-h-[190px] overflow-hidden p-5" style={titleStyle(t.id)}>
        <TitleAuraLayer titleId={t.id} compact />
        <EventRibbon t={t} />
        <div className="relative z-[1] flex h-full flex-col gap-2">
          <div className="flex items-center gap-3">
            <SidIcon name={t.icon} size={40} className="drop-shadow" />
            <div className="min-w-0">
              <p className="font-display text-lg uppercase leading-tight tracking-wide" style={{ color: t.colors[0] }}>
                {t.name}
              </p>
              {t.maxLevel > 1 && (
                <p className="font-mono text-[10px] uppercase tracking-wide text-paper/70">
                  Niveau {roman(o.level)} / {roman(t.maxLevel)}
                </p>
              )}
            </div>
          </div>
          <p className="font-body text-xs text-paper/75">
            <strong>{POWERS[t.power].name}.</strong> {POWERS[t.power].description}
          </p>
          <p className="font-mono text-[10px] text-paper/50">
            {t.how} · le {new Date(o.obtained_at).toLocaleDateString("fr-FR")}
          </p>
          <div className="mt-auto pt-1">
            {isEquipped ? (
              <TitleBadge titleId={t.id} level={o.level} size="sm" />
            ) : (
              <button
                onClick={() => equip(t.id)}
                disabled={busy !== null}
                className="rounded-lg px-3 py-1.5 font-display text-xs uppercase tracking-wide text-ink"
                style={{ background: `linear-gradient(110deg, ${t.colors[0]}, ${t.colors[1]})` }}
              >
                {busy === t.id ? "…" : "Équiper"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Titres</h1>
        <p className="max-w-2xl font-body text-sm text-paper/70">
          Douze titres secrets, et un titre par événement. Chacun s&apos;obtient d&apos;une façon cachée, transforme ton
          dossier une fois équipé et donne un pouvoir de farce. Tu en possèdes{" "}
          <strong className="text-paper">{ownedCount}</strong> sur {TITLES.length}.
        </p>
      </div>

      {/* Vitrine du titre équipé */}
      <div className={`glass-card relative overflow-hidden p-6 ${equipped ? "min-h-[150px]" : ""}`}>
        {equipped && <TitleAuraLayer titleId={equipped.id} dragon={dragon} />}
        <div className="relative z-[1] flex flex-wrap items-center gap-4">
          <div className="drop-shadow-lg" aria-hidden>
            <SidIcon name={equipped ? (dragon ? "dragon" : equipped.icon) : "tag"} size={60} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60">Titre équipé</p>
            {equipped ? (
              <>
                <h2 className="font-display text-3xl uppercase tracking-wide" style={{ color: equipped.colors[0], textShadow: `0 0 18px ${equipped.colors[1]}` }}>
                  {equipped.name}
                  {equipped.maxLevel > 1 && <span className="ml-2 text-xl">{roman(owned.get(equipped.id)?.level ?? 1)}</span>}
                </h2>
                <p className="font-body text-sm text-paper/80">
                  {me.nickname} — c&apos;est ce que les autres voient sur ton dossier, au trombinoscope, au classement et dans la
                  messagerie.
                </p>
              </>
            ) : (
              <p className="font-body text-sm text-paper/70">Aucun titre équipé pour l&apos;instant.</p>
            )}
          </div>
          {equipped && (
            <button onClick={() => equip(null)} disabled={busy !== null} className="rounded-lg border border-white/25 bg-black/30 px-3 py-1.5 font-mono text-xs uppercase text-paper/80 hover:bg-white/10">
              Retirer
            </button>
          )}
        </div>
      </div>

      {equipped && status.shielded && (
        <p className="font-mono text-xs text-paper/50"><SidIcon name="shield" /> L&apos;administration t&apos;a mis à l&apos;abri des farces des autres.</p>
      )}

      {equipped && <TrollPanel status={status} myId={me.id} myName={me.nickname} initialTarget={params.get("target")} onChange={load} />}

      {/* Collection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{SECRET_TITLES.map(card)}</div>

      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-paper">Titres d&apos;événement</h2>
          <p className="max-w-2xl font-body text-sm text-paper/60">
            Un par événement. Il ne s&apos;obtient que pendant l&apos;événement… mais se garde pour toujours.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{EVENT_TITLES.map(card)}</div>
      </div>
    </div>
  );
}

function EventRibbon({ t }: { t: TitleDef }) {
  if (!t.event) return null;
  return (
    <span className="event-title-ribbon z-[2]" style={{ background: `linear-gradient(90deg, ${t.colors[0]}, ${t.colors[1]})` }}>
      <SidIcon name={EVENTS[t.event].icon} size="1.25em" /> {EVENTS[t.event].name}
    </span>
  );
}

export default function TitlesPage() {
  return (
    <Suspense fallback={<p className="font-body text-paper/60">Ouverture de la vitrine…</p>}>
      <TitlesInner />
    </Suspense>
  );
}
