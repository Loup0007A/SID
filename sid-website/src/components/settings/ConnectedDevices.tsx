"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonOutline, buttonGhostRed } from "@/lib/ui";

/**
 * Appareils connectés (Lot 96, migration 0121) : les sessions ouvertes du
 * compte, valables pour les trois sites. Déconnecter un appareil ferme sa
 * session : son accès en cours expire dans l'heure au plus.
 */
type Appareil = { id: string; debut: string; activite: string; appareil: string; actuel: boolean };

/** « Chrome sur Android », « Safari sur iPhone »… d'après l'identifiant du navigateur. */
export function nomAppareil(ua: string): string {
  if (!ua) return "Appareil inconnu";
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /SamsungBrowser/.test(ua)
          ? "Samsung Internet"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navigateur";
  const sys = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  return sys ? `${nav} sur ${sys}` : nav;
}

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ConnectedDevices() {
  const supabase = createClient();
  const [list, setList] = useState<Appareil[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("mes_appareils");
    if (error) {
      setList([]);
      setMessage(/mes_appareils|PGRST202/.test(`${error.message} ${error.code}`) ? "Pas encore disponible : la migration 0121 doit être lancée." : `Échec : ${error.message}`);
      return;
    }
    setList((data ?? []) as Appareil[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deconnecter(a: Appareil) {
    setBusy(a.id);
    setMessage(null);
    const { error } = await supabase.rpc("appareil_deconnecter", { p_id: a.id });
    setBusy(null);
    if (error) return setMessage(`Échec : ${error.message}`);
    setMessage(`${nomAppareil(a.appareil)} déconnecté. Il devra se reconnecter dans l'heure au plus.`);
    load();
  }

  async function deconnecterAutres() {
    setBusy("autres");
    setMessage(null);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setBusy(null);
    if (error) return setMessage(`Échec : ${error.message}`);
    setMessage("Tous les autres appareils sont déconnectés. Ils devront se reconnecter dans l'heure au plus.");
    load();
  }

  const autres = (list ?? []).filter((a) => !a.actuel);

  return (
    <section className="glass-card space-y-3 p-6" aria-labelledby="appareils-titre">
      <h2 id="appareils-titre" className="font-display text-lg uppercase">
        Appareils connectés
      </h2>
      <p className="font-body text-sm text-paper/80">
        Les navigateurs où ton compte est ouvert, pour les trois sites. Si tu n&apos;en reconnais pas un, déconnecte-le
        et change ton mot de passe.
      </p>
      {message && <p className="rounded-lg bg-blue/10 px-3 py-2 font-mono text-xs text-blue-light">{message}</p>}
      {list === null ? (
        <p className="font-body text-sm text-paper/70">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="font-body text-sm text-paper/70">Aucune session trouvée.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-body font-semibold">
                  {nomAppareil(a.appareil)}
                  {a.actuel && <span className="ml-2 rounded-full bg-green-300 px-2 py-0.5 font-mono text-[11px] text-encre">Cet appareil</span>}
                </p>
                <p className="font-mono text-[11px] text-paper/70">
                  Connecté le {quand(a.debut)} · dernière activité le {quand(a.activite)}
                </p>
              </div>
              {!a.actuel && (
                <button onClick={() => deconnecter(a)} disabled={busy !== null} className={buttonGhostRed}>
                  {busy === a.id ? "…" : "Déconnecter"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {autres.length > 1 && (
        <button onClick={deconnecterAutres} disabled={busy !== null} className={buttonOutline}>
          {busy === "autres" ? "…" : "Déconnecter tous les autres appareils"}
        </button>
      )}
    </section>
  );
}
