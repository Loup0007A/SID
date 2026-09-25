"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MapPlace, CityBuilding, CharacterPosition, ActivePosition } from "@/types/map";
import { inputClass, labelClass } from "@/lib/ui";

function formatCountdown(secondsLeft: number) {
  const s = Math.max(0, Math.round(secondsLeft));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function MapPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [myPosition, setMyPosition] = useState<CharacterPosition | null>(null);
  const [roster, setRoster] = useState<ActivePosition[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // formulaire "ma position"
  const [placeId, setPlaceId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [note, setNote] = useState("");
  const [isVisible, setIsVisible] = useState(true);

  // chronomètre live (recalculé côté client à partir de travel_started_at,
  // pas d'un simple compteur qui dérive)
  const [now, setNow] = useState(() => Date.now());
  const [activeRouteWeight, setActiveRouteWeight] = useState<number | null>(null);

  const placeName = useCallback((id: string | null) => places.find((p) => p.id === id)?.name ?? "Lieu inconnu", [places]);

  async function refresh() {
    const [{ data: p }, { data: b }, { data: active }] = await Promise.all([
      supabase.from("map_places").select("id, name, type"),
      supabase.from("city_buildings").select("id, name"),
      supabase.rpc("list_active_positions"),
    ]);
    setPlaces(p ?? []);
    setBuildings(b ?? []);
    setRoster((active ?? []) as ActivePosition[]);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fait avancer / finaliser le trajet en cours avant d'afficher quoi que ce soit
      try {
        await supabase.rpc("advance_my_travel");
      } catch {
        // silencieux
      }

      const { data: mine } = await supabase.from("character_positions").select("*").eq("user_id", user.id).maybeSingle();
      if (mine) {
        setMyPosition(mine as CharacterPosition);
        setPlaceId(mine.place_id ?? "");
        setBuildingId(mine.building_id ?? "");
        setNote(mine.note ?? "");
        setIsVisible(mine.is_visible ?? true);
      }

      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Récupère le poids (en minutes) de la route active, pour le compte à
  // rebours — recalculé si le segment actif change.
  useEffect(() => {
    (async () => {
      if (!myPosition?.route_id) {
        setActiveRouteWeight(null);
        return;
      }
      const { data } = await supabase.from("map_routes").select("travel_minutes, path_points").eq("id", myPosition.route_id).single();
      if (!data) {
        setActiveRouteWeight(null);
        return;
      }
      if (data.travel_minutes != null) {
        setActiveRouteWeight(data.travel_minutes);
      } else {
        const points = (data.path_points ?? []) as { x: number; y: number }[];
        let len = 0;
        for (let i = 1; i < points.length; i++) {
          len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        }
        setActiveRouteWeight(Math.max(5, len * 2));
      }
    })();
  }, [myPosition?.route_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick d'affichage du compte à rebours (aucune écriture en base ici — la
  // progression réelle est recalculée à partir de travel_started_at côté
  // serveur via advance_my_travel()).
  useEffect(() => {
    if (!myPosition?.travel_started_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [myPosition?.travel_started_at]);

  async function saveMyPosition() {
    if (!userId) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("character_positions").upsert({
      user_id: userId,
      place_id: placeId || null,
      building_id: buildingId || null,
      note: note || null,
      is_visible: isVisible,
      route_id: null,
      route_progress: null,
      travel_started_at: null,
      planned_path: null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage("Position mise à jour.");
    setMyPosition({
      user_id: userId,
      place_id: placeId || null,
      building_id: buildingId || null,
      route_id: null,
      route_progress: null,
      travel_started_at: null,
      planned_path: null,
      note: note || null,
      is_visible: isVisible,
      updated_at: new Date().toISOString(),
    });
    await refresh();
  }

  const isTraveling = !!myPosition?.route_id && !!myPosition?.travel_started_at;
  let secondsLeft = 0;
  let progressPct = 0;
  if (isTraveling && activeRouteWeight != null && myPosition?.travel_started_at) {
    const startedMs = new Date(myPosition.travel_started_at).getTime();
    const totalMs = activeRouteWeight * 60_000;
    const elapsedMs = now - startedMs;
    secondsLeft = Math.max(0, (totalMs - elapsedMs) / 1000);
    progressPct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  }
  const stepsRemaining = (myPosition?.planned_path?.length ?? 1) - 1;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Carte du S.I.D.</h1>
      <p className="font-body text-sm text-paper/70">
        Carte visuelle complète sur{" "}
        <a href="https://sid-map.vercel.app" target="_blank" rel="noreferrer" className="text-blue underline">
          sid-map.vercel.app
        </a>{" "}
        — cette page permet de consulter et changer sa position depuis le site principal.
      </p>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {isTraveling && (
        <div className="glass-card space-y-2 border border-blue/50 p-4">
          <p className="font-display uppercase text-blue-light">En trajet…</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-blue transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="font-mono text-xs text-paper/70">
            Arrivée {stepsRemaining > 0 ? `à cette étape ` : ""}dans {formatCountdown(secondsLeft)}
            {stepsRemaining > 0 && ` (encore ${stepsRemaining} étape${stepsRemaining > 1 ? "s" : ""} après celle-ci)`}
          </p>
        </div>
      )}

      <div className="glass-card space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">Ma position</h2>
        <div className="space-y-1">
          <label className={labelClass}>Lieu</label>
          <select className={inputClass} value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">— Non renseigné —</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Bâtiment (précision optionnelle)</label>
          <select className={inputClass} value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">— Aucun —</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Note libre (si pas de lieu précis)</label>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : quelque part en forêt…" />
        </div>
        <label className="flex items-center gap-2 font-mono text-xs">
          <input type="checkbox" className="accent-blue" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} />
          Visible par les autres membres
        </label>
        <button
          onClick={saveMyPosition}
          disabled={saving}
          className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Mettre à jour ma position"}
        </button>
        <p className="font-mono text-[10px] text-paper/50">
          Enregistrer ici efface un trajet en cours — utilise les quêtes pour lancer un déplacement chronométré.
        </p>
      </div>

      <div className="glass-card space-y-2 p-6">
        <h2 className="font-display text-lg uppercase">Qui est où</h2>
        {roster.length === 0 ? (
          <p className="font-body text-sm text-paper/60">Personne n&apos;a partagé sa position pour le moment.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {roster.map((r) => (
              <li key={r.user_id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatar_url} alt={r.nickname} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-dark font-display text-xs text-ink">
                      {r.nickname.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="font-display uppercase">{r.nickname}</span>
                </div>
                <span className="font-mono text-xs text-paper/60">
                  {r.route_id ? "En déplacement…" : r.place_id ? placeName(r.place_id) : r.note || "Position inconnue"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
