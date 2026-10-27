"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/session";
import type { MapPlace, CityBuilding, CharacterPosition, ActivePosition } from "@/types/map";
import { findShortestPath } from "@/lib/pathfinding";
import { inputClass, labelClass } from "@/lib/ui";
import { formatCountdown, formatMinutes, tripState } from "@/lib/travel";
import { SidIcon } from "@/components/icons/SidIcon";

export default function MapPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [myPosition, setMyPosition] = useState<CharacterPosition | null>(null);
  const [roster, setRoster] = useState<ActivePosition[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);

  // Point de départ (une seule fois, jamais après)
  const [spawnPlaceId, setSpawnPlaceId] = useState("");
  const [spawnBuildingId, setSpawnBuildingId] = useState("");
  const [spawnNote, setSpawnNote] = useState("");
  const [spawnVisible, setSpawnVisible] = useState(true);
  const [spawning, setSpawning] = useState(false);

  // Préférences (bâtiment / note / visibilité) — jamais un déplacement
  const [prefBuildingId, setPrefBuildingId] = useState("");
  const [prefNote, setPrefNote] = useState("");
  const [prefVisible, setPrefVisible] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Trajet vers un nouveau lieu
  const [destPlaceId, setDestPlaceId] = useState("");
  const [launching, setLaunching] = useState(false);

  // chronomètre live (recalculé côté client à partir de travel_started_at,
  // pas d'un simple compteur qui dérive)
  const [now, setNow] = useState(() => Date.now());
  const advancingRef = useRef(false);
  const [routes, setRoutes] = useState<import("@/types/map").MapRoute[]>([]);

  const placeName = useCallback((id: string | null) => places.find((p) => p.id === id)?.name ?? "Lieu inconnu", [places]);

  async function refresh() {
    const [{ data: p }, { data: b }, { data: r }, { data: active }] = await Promise.all([
      supabase.from("map_places").select("id, name, type"),
      supabase.from("city_buildings").select("id, name"),
      supabase.from("map_routes").select("*"),
      supabase.rpc("list_active_positions"),
    ]);
    setPlaces(p ?? []);
    setBuildings(b ?? []);
    setRoutes((r ?? []) as import("@/types/map").MapRoute[]);
    setRoster((active ?? []) as ActivePosition[]);
  }

  async function refreshMine(uid: string) {
    const { data: mine } = await supabase.from("character_positions").select("*").eq("user_id", uid).maybeSingle();
    const pos = (mine as CharacterPosition) ?? null;
    setMyPosition(pos);
    if (pos?.spawned) {
      setPrefBuildingId(pos.building_id ?? "");
      setPrefNote(pos.note ?? "");
      setPrefVisible(pos.is_visible ?? true);
    }
    return pos;
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await currentUser();
      if (!user) return;
      setUserId(user.id);

      // La carte (lieux, routes, présents) n'attend pas : elle part tout de
      // suite. Le trajet en cours avance / se finalise avant de relire sa
      // propre position.
      const mapP = refresh();
      try {
        await supabase.rpc("advance_my_travel");
      } catch {
        // silencieux
      }
      await Promise.all([refreshMine(user.id), mapP]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trajet en cours : le compte à rebours tourne chaque seconde ; quand une
  // étape se termine, le serveur enchaîne la suivante (ou pose l'arrivée) et
  // on l'affiche tout de suite. Toutes les 20 s, on relit aussi la position
  // (un trajet lancé ou terminé depuis la Cartographie apparaît ici).
  useEffect(() => {
    if (!myPosition?.travel_started_at || !userId) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      refreshMine(userId);
    }, 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [myPosition?.travel_started_at, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const trip = tripState(myPosition, routes, now);

  useEffect(() => {
    if (!trip || trip.legSecondsLeft > 0 || advancingRef.current || !userId) return;
    advancingRef.current = true;
    (async () => {
      const before = myPosition;
      try {
        await supabase.rpc("advance_my_travel");
      } catch {
        // silencieux : on relit la position quoi qu'il arrive
      }
      const after = await refreshMine(userId);
      if (before?.travel_started_at && after && !after.travel_started_at) {
        setArrival(`Tu es arrivé à ${placeName(after.place_id)}.`);
        refresh();
      }
      // Laisse le temps au serveur si l'horloge du téléphone avance un peu.
      setTimeout(() => {
        advancingRef.current = false;
      }, 4000);
    })();
  }, [trip && trip.legSecondsLeft <= 0 ? Math.floor(now / 5000) : -1, myPosition?.travel_started_at, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function spawn() {
    if (!userId || !spawnPlaceId) {
      setMessage("Choisis un lieu de départ.");
      return;
    }
    setSpawning(true);
    setMessage(null);
    const { error } = await supabase.rpc("set_initial_position", {
      p_place_id: spawnPlaceId,
      p_building_id: spawnBuildingId || null,
      p_note: spawnNote || null,
      p_is_visible: spawnVisible,
    });
    setSpawning(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage("Point de départ posé.");
    await refreshMine(userId);
    await refresh();
  }

  async function savePrefs() {
    if (!userId) return;
    setSavingPrefs(true);
    setMessage(null);
    const { error } = await supabase.rpc("update_position_prefs", {
      p_building_id: prefBuildingId || null,
      p_note: prefNote || null,
      p_is_visible: prefVisible,
    });
    setSavingPrefs(false);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage("Préférences mises à jour.");
    await refreshMine(userId);
    await refresh();
  }

  async function launchTravel() {
    if (!myPosition?.place_id || !destPlaceId) return;
    const plan = findShortestPath(routes, myPosition.place_id, destPlaceId);
    if (!plan) {
      setMessage("Aucun itinéraire connu vers ce lieu.");
      return;
    }
    if (plan.steps.length === 0) {
      setMessage("Tu es déjà sur place !");
      return;
    }
    setLaunching(true);
    setMessage(null);
    setArrival(null);
    const { error } = await supabase.rpc("start_travel", {
      p_planned_path: plan.steps.map((s) => ({ route_id: s.route_id, to_place_id: s.to_place_id })),
    });
    setLaunching(false);
    if (error) {
      setMessage(`Échec du départ : ${error.message}`);
      return;
    }
    setDestPlaceId("");
    if (userId) await refreshMine(userId);
    await refresh();
  }

  const isTraveling = !!trip;
  const destEta = myPosition?.place_id && destPlaceId ? findShortestPath(routes, myPosition.place_id, destPlaceId) : null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-red">Carte du S.I.D.</h1>
      <p className="font-body text-sm text-paper/70">
        Carte visuelle complète sur{" "}
        <a href="https://sid-map.vercel.app" target="_blank" rel="noreferrer" className="text-blue underline">
          sid-map.vercel.app
        </a>{" "}
        — cette page permet de consulter sa position et de se déplacer, chaque trajet prenant un temps réel à parcourir
        (aucune téléportation possible).
      </p>

      {arrival && (
        <p className="glass-card border border-blue/50 p-3 font-mono text-sm text-blue-light"><SidIcon name="pin" /> {arrival}</p>
      )}
      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {!myPosition?.spawned ? (
        <div data-tuto="carte-position" className="glass-card space-y-4 p-6">
          <h2 className="font-display text-lg uppercase">Choisis ton point de départ</h2>
          <p className="font-body text-sm text-paper/70">
            À poser une seule fois — ensuite, tout changement de lieu se fera en lançant un trajet chronométré.
          </p>
          <div className="space-y-1">
            <label className={labelClass}>Lieu</label>
            <select className={inputClass} value={spawnPlaceId} onChange={(e) => setSpawnPlaceId(e.target.value)}>
              <option value="">— Choisir —</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Bâtiment (précision optionnelle)</label>
            <select className={inputClass} value={spawnBuildingId} onChange={(e) => setSpawnBuildingId(e.target.value)}>
              <option value="">— Aucun —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Note libre</label>
            <input className={inputClass} value={spawnNote} onChange={(e) => setSpawnNote(e.target.value)} placeholder="Ex : quelque part en forêt…" />
          </div>
          <label className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" className="accent-blue" checked={spawnVisible} onChange={(e) => setSpawnVisible(e.target.checked)} />
            Visible par les autres membres
          </label>
          <button
            onClick={spawn}
            disabled={spawning || !spawnPlaceId}
            className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase text-ink hover:bg-red-light disabled:opacity-40"
          >
            {spawning ? "…" : "Poser mon point de départ"}
          </button>
        </div>
      ) : (
        <>
          {isTraveling ? (
            <div className="glass-card space-y-2 border border-blue/50 p-4">
              <p className="font-display uppercase text-blue-light">
                {trip!.isFlight ? <><SidIcon name="dove" /> En vol</> : <><SidIcon name="road" /> En trajet</>} vers {placeName(trip!.destinationId)}
              </p>
              {trip!.legCount > 1 && (
                <p className="font-mono text-xs text-paper/60">
                  Étape en cours : vers {placeName(trip!.nextStopId)} — encore {trip!.legCount - 1} étape
                  {trip!.legCount - 1 > 1 ? "s" : ""} après
                </p>
              )}
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-blue transition-all" style={{ width: `${Math.round(trip!.legProgress * 100)}%` }} />
              </div>
              <p className="font-mono text-xs text-paper/70">
                {trip!.totalSecondsLeft <= 0
                  ? "Arrivée en cours…"
                  : `Arrivée dans ${formatCountdown(trip!.totalSecondsLeft)}`}
              </p>
              <p className="font-body text-xs text-paper/65">
                Le trajet continue même si tu fermes la page ou passes sur la Cartographie : tu arriveras à l&apos;heure prévue.
              </p>
            </div>
          ) : (
            <div data-tuto="carte-position" className="glass-card space-y-1 p-4">
              <p className="font-display uppercase text-blue-light"><SidIcon name="pin" /> {placeName(myPosition.place_id)}</p>
              {myPosition.building_id && (
                <p className="font-mono text-xs text-paper/60">
                  Bâtiment : {buildings.find((b) => b.id === myPosition.building_id)?.name ?? "—"}
                </p>
              )}
              {myPosition.note && <p className="font-body text-sm text-paper/80">{myPosition.note}</p>}
            </div>
          )}

          {!isTraveling && (
            <div data-tuto="carte-trajet" className="glass-card space-y-4 p-6">
              <h2 className="font-display text-lg uppercase">Se déplacer</h2>
              <div className="space-y-1">
                <label className={labelClass}>Destination</label>
                <select className={inputClass} value={destPlaceId} onChange={(e) => setDestPlaceId(e.target.value)}>
                  <option value="">— Choisir un lieu —</option>
                  {places.filter((p) => p.id !== myPosition.place_id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>
              {destPlaceId && (
                <p className="font-mono text-xs text-paper/60">
                  {destEta
                    ? `≈ ${formatMinutes(destEta.totalMinutes)} de trajet à pied${destEta.steps.length > 1 ? ` (${destEta.steps.length} étapes)` : ""} — plus rapide avec une monture`
                    : "Aucun itinéraire connu vers ce lieu."}
                </p>
              )}
              <button
                onClick={launchTravel}
                disabled={launching || !destPlaceId || !destEta}
                className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light disabled:opacity-40"
              >
                {launching ? "Départ…" : "Lancer le trajet"}
              </button>
            </div>
          )}

          <div className="glass-card space-y-4 p-6">
            <h2 className="font-display text-lg uppercase">Préférences</h2>
            <p className="font-body text-sm text-paper/70">
              Ne changent pas ton lieu — juste un détail de mise en scène, modifiable à tout moment.
            </p>
            <div className="space-y-1">
              <label className={labelClass}>Bâtiment (précision optionnelle)</label>
              <select className={inputClass} value={prefBuildingId} onChange={(e) => setPrefBuildingId(e.target.value)}>
                <option value="">— Aucun —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Note libre</label>
              <input className={inputClass} value={prefNote} onChange={(e) => setPrefNote(e.target.value)} placeholder="Ex : quelque part en forêt…" />
            </div>
            <label className="flex items-center gap-2 font-mono text-xs">
              <input type="checkbox" className="accent-blue" checked={prefVisible} onChange={(e) => setPrefVisible(e.target.checked)} />
              Visible par les autres membres
            </label>
            <button
              onClick={savePrefs}
              disabled={savingPrefs}
              className="rounded-lg bg-blue px-4 py-2 font-display text-sm uppercase text-ink hover:bg-blue-light disabled:opacity-40"
            >
              {savingPrefs ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </>
      )}

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
                  {r.travel_started_at || r.route_id ? "En déplacement…" : r.place_id ? placeName(r.place_id) : r.note || "Position inconnue"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
