import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Relais de l'Arène du Dragon (Lot 36).
 *
 * Le jeu (iframe arena.html) ne parle qu'à cette page ; c'est elle qui fait
 * passer les échanges par Supabase Realtime. Pour ménager le quota de
 * messages (chaque message envoyé ET chaque message reçu compte), on fait une
 * étoile autour du dragon et on regroupe :
 *
 *  - chaque joueur envoie, au plus 3 fois par seconde, un paquet (sa dernière
 *    position + ses événements) sur son canal montant « arena:<id>:u:<joueur> »,
 *    que seul le dragon écoute ;
 *  - le dragon renvoie à tous, au plus 3 fois par seconde, un paquet commun
 *    sur « arena:<id> » : sa position, celles des joueurs, les événements.
 *    Les joueurs et la tribune écoutent ce canal.
 *
 * Aucune donnée n'est écrite en base ici (la fin passe par arena_finish).
 */

export type ArenaRole = "dragon" | "player" | "spectator";
export type ArenaPerson = { id: string; name: string };
export interface ArenaBattle {
  id: string;
  actor: ArenaPerson;
  players: ArenaPerson[];
  skin: string;
  finale: string | null;
  spectators: boolean;
}

type GameMsg = Record<string, unknown>;
type Ev = { ev: string; p: unknown; from: ArenaPerson };
type UpPacket = { s?: unknown; e?: { ev: string; p: unknown }[] };
type DownPacket = { s?: unknown; h?: Record<string, unknown>; e?: Ev[] };

export const ARENA_FLUSH_MS = 330;
/** Événements utiles au seul dragon : on ne les renvoie pas aux autres. */
const HOST_ONLY = new Set(["hit", "hi"]);

export interface ArenaRelay {
  /** Le jeu a fini de charger (message « ready »). */
  gameReady(): void;
  /** Le jeu envoie un événement (message « send »). */
  fromGame(event: string, payload: unknown): void;
  close(): void;
}

export function connectArena(
  supabase: SupabaseClient,
  battle: ArenaBattle,
  role: ArenaRole,
  me: ArenaPerson,
  toGame: (msg: GameMsg) => void
): ArenaRelay {
  const channels: RealtimeChannel[] = [];
  let pending = 0;
  let ready = false;
  let joinedSent = false;
  let closed = false;
  const names = new Map<string, string>([[battle.actor.id, battle.actor.name], ...battle.players.map((p) => [p.id, p.name] as [string, string])]);
  const person = (id: string): ArenaPerson => ({ id, name: names.get(id) ?? "?" });

  const deliver = (event: string, payload: unknown, from: ArenaPerson) => {
    if (closed || from.id === me.id) return;
    toGame({ type: "sid-arena", action: "event", event, payload: payload ?? {}, from });
  };

  const maybeJoined = () => {
    if (closed || joinedSent || !ready || pending > 0) return;
    joinedSent = true;
    toGame({ type: "sid-arena", action: "joined", me, role, battle });
  };

  const open = (name: string, onPacket?: (p: unknown) => void) => {
    pending++;
    let counted = false;
    const ch = supabase.channel(name, { config: { broadcast: { self: false } } });
    if (onPacket) ch.on("broadcast", { event: "a" }, ({ payload }) => onPacket(payload));
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (!counted) {
          counted = true;
          pending--;
          maybeJoined();
        }
      } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !counted) {
        toGame({ type: "sid-arena", action: "error", message: "Connexion temps réel impossible." });
      }
    });
    channels.push(ch);
    return ch;
  };

  const send = (ch: RealtimeChannel, payload: unknown) => {
    if (!closed) void ch.send({ type: "broadcast", event: "a", payload });
  };

  // État à envoyer au prochain paquet.
  let myState: unknown = null;
  let myDirty = false;
  const queue: Ev[] = [];
  let flush: () => void = () => {};

  if (role === "dragon") {
    const down = open(`arena:${battle.id}`);
    const heroes = new Map<string, unknown>();
    const dirty = new Set<string>();
    for (const p of battle.players) {
      open(`arena:${battle.id}:u:${p.id}`, (raw) => {
        const pk = raw as UpPacket;
        if (!pk || typeof pk !== "object") return;
        const from = person(p.id);
        if (pk.s) {
          deliver("st", pk.s, from);
          heroes.set(p.id, pk.s);
          dirty.add(p.id);
        }
        for (const e of Array.isArray(pk.e) ? pk.e.slice(0, 40) : []) {
          if (!e || typeof e.ev !== "string") continue;
          deliver(e.ev, e.p, from);
          if (!HOST_ONLY.has(e.ev)) queue.push({ ev: e.ev, p: e.p, from });
        }
      });
    }
    flush = () => {
      if (!myDirty && !dirty.size && !queue.length) return;
      const h: Record<string, unknown> = {};
      dirty.forEach((id) => (h[id] = heroes.get(id)));
      const pk: DownPacket = { s: myDirty ? myState : undefined, h: dirty.size ? h : undefined, e: queue.length ? queue.splice(0, 60) : undefined };
      myDirty = false;
      dirty.clear();
      send(down, pk);
    };
  } else {
    const onDown = (raw: unknown) => {
      const pk = raw as DownPacket;
      if (!pk || typeof pk !== "object") return;
      if (pk.s) deliver("st", pk.s, battle.actor);
      if (pk.h && typeof pk.h === "object") for (const [id, st] of Object.entries(pk.h)) deliver("st", st, person(id));
      for (const e of Array.isArray(pk.e) ? pk.e : []) {
        if (e && typeof e.ev === "string" && e.from && typeof e.from.id === "string") deliver(e.ev, e.p, e.from);
      }
    };
    open(`arena:${battle.id}`, onDown);
    if (role === "player") {
      const up = open(`arena:${battle.id}:u:${me.id}`);
      flush = () => {
        if (!myDirty && !queue.length) return;
        const pk: UpPacket = { s: myDirty ? myState : undefined, e: queue.length ? queue.splice(0, 40).map(({ ev, p }) => ({ ev, p })) : undefined };
        myDirty = false;
        send(up, pk);
      };
    }
  }

  const timer = setInterval(() => flush(), ARENA_FLUSH_MS);

  return {
    gameReady() {
      ready = true;
      maybeJoined();
    },
    fromGame(event, payload) {
      if (closed || role === "spectator") return;
      if (event === "st") {
        myState = payload;
        myDirty = true;
      } else if (queue.length < 200) {
        queue.push({ ev: event, p: payload, from: me });
      }
    },
    close() {
      if (closed) return;
      flush();
      closed = true;
      clearInterval(timer);
      channels.forEach((ch) => void supabase.removeChannel(ch));
    },
  };
}
