import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/** Raid ouvert (list_open_boss_raids, migration 0053). */
export interface BossRaid {
  id: string;
  host_id: string;
  host_nickname: string | null;
  story: number;
  chapter: number;
  boss_name: string;
  dragon: boolean;
  created_at: string;
  expires_at: string;
  members: number;
}

/** Raid auquel la page participe (hôte ou allié). */
export interface ActiveRaid {
  id: string;
  isHost: boolean;
  dragon: boolean;
  hostName: string;
}

/**
 * Relais temps réel d'un raid : la page du S.I.D. fait passer les messages
 * du jeu (iframe) sur le canal Supabase Realtime « raid:<id> », et ceux des
 * autres joueurs vers le jeu. Aucune donnée n'est écrite en base.
 */
export function connectRaid(
  supabase: SupabaseClient,
  raid: ActiveRaid,
  me: { id: string; name: string },
  toGame: (msg: Record<string, unknown>) => void
): RealtimeChannel {
  const channel = supabase.channel(`raid:${raid.id}`, { config: { broadcast: { self: false } } });
  channel
    .on("broadcast", { event: "raid" }, ({ payload }) => {
      const p = payload as { event?: string; payload?: unknown; from?: { id?: string; name?: string } };
      if (!p || typeof p.event !== "string") return;
      toGame({ type: "sid-raid", action: "event", event: p.event, payload: p.payload ?? {}, from: p.from ?? {} });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        toGame({ type: "sid-raid", action: "joined", raidId: raid.id, isHost: raid.isHost, dragon: raid.dragon, hostName: raid.hostName, me });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        toGame({ type: "sid-raid", action: "error", message: "Connexion temps réel impossible." });
      }
    });
  return channel;
}

export function sendRaidEvent(channel: RealtimeChannel, me: { id: string; name: string }, event: string, payload: unknown) {
  void channel.send({ type: "broadcast", event: "raid", payload: { event, payload, from: me } });
}
