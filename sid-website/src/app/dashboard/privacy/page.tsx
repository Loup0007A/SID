"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { inputClass, buttonPrimary, buttonOutline, buttonGhostRed } from "@/lib/ui";
import { TERMS_VERSION, TERMS_DATE } from "@/components/legal/LegalContent";

type PrivacyRequest = { id: number; status: string; created_at: string; reason: string | null; note: string | null; handled_at: string | null };

const HIDEABLE: Record<string, string> = {
  first_name: "prénom",
  last_name: "nom",
  age: "âge",
  weapons: "armes",
  equipment: "équipement",
  description: "description",
  desired_role: "rôle voulu",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function PrivacyPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data as Profile);
    const { data: req } = await supabase.from("privacy_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRequests((req ?? []) as PrivacyRequest[]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return <p className="font-body text-paper/60">Chargement…</p>;

  const pending = requests.find((r) => r.status === "pending");
  const hidden = (profile.hidden_fields ?? []).map((f) => HIDEABLE[f] ?? f);
  const accepted = profile.terms_version === TERMS_VERSION;

  async function download() {
    setBusy("export");
    setMessage(null);
    const { data, error } = await supabase.rpc("export_my_data");
    setBusy(null);
    if (error) {
      setMessage(error.message.includes("export_my_data") ? "Pas encore disponible : la migration 0060 doit être lancée." : `Échec : ${error.message}`);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sid-mes-donnees-${profile?.nickname ?? "export"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Export téléchargé : un fichier JSON avec tout ce qui est lié à ton compte.");
  }

  async function acceptTerms() {
    setBusy("terms");
    const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
    setBusy(null);
    if (error) setMessage(`Échec : ${error.message}`);
    else refresh();
  }

  async function requestDeletion() {
    setBusy("delete");
    setMessage(null);
    const { error } = await supabase.rpc("request_account_deletion", { p_reason: reason });
    setBusy(null);
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setReason("");
    setUnderstood(false);
    setMessage("Ta demande est envoyée à l'administration. Ton compte sera supprimé sous 30 jours au plus ; tu peux encore l'annuler ici.");
    refresh();
  }

  async function cancelDeletion() {
    setBusy("cancel");
    const { error } = await supabase.rpc("cancel_account_deletion");
    setBusy(null);
    if (error) setMessage(`Échec : ${error.message}`);
    else {
      setMessage("Demande annulée : ton compte reste actif.");
      refresh();
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl uppercase tracking-wide text-red">Mes données</h1>
        <p className="font-body text-sm text-paper/70">
          Ce que le S.I.D. garde sur toi, qui peut le voir, et ce que tu peux en faire. Valable pour le Dossier Central,
          la Cartographie et le Wiki (un seul compte). Tout est détaillé dans la{" "}
          <Link href="/confidentialite" className="text-blue-light underline">politique de confidentialité</Link>.
        </p>
      </div>

      {message && <p className="rounded-lg bg-blue/10 px-3 py-2 font-mono text-xs text-blue-light">{message}</p>}

      <section className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Ce que nous gardons</h2>
        <ul className="list-disc space-y-1 pl-5 font-body text-sm text-paper/80">
          <li>Ton compte (email ; le mot de passe est chiffré et illisible) et ton dossier.</li>
          <li>Ton activité de jeu : quêtes, zénis, achats, entreprises, simulations, arbre techno, raids.</li>
          <li>Tes messages, tes salons, tes notifications.</li>
          <li>Ta position et tes trajets sur la carte ; tes commentaires, favoris et notes du wiki.</li>
          <li>Ta dernière visite et ton nombre de visites par jour (pas les pages vues, pas d&apos;adresse IP).</li>
        </ul>
        <button onClick={download} disabled={busy !== null} className={buttonPrimary}>
          {busy === "export" ? "Préparation…" : "Télécharger toutes mes données"}
        </button>
        <p className="font-mono text-[11px] text-paper/50">Fichier JSON lisible, à garder pour toi ou à emporter ailleurs.</p>
      </section>

      <section className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Qui voit quoi</h2>
        <ul className="list-disc space-y-1 pl-5 font-body text-sm text-paper/80">
          <li>
            <strong>Les autres membres</strong> voient ton dossier public
            {hidden.length > 0 ? <> sauf : {hidden.join(", ")}</> : <> (tu ne masques aucun champ)</>}.
            {profile.is_invisible ? " Ton compte est invisible : tu n'apparais pas dans les listes, le classement ni la carte." : ""}
          </li>
          <li>
            <strong>L&apos;administration</strong> (gestion des comptes) voit tout ton dossier et un journal de ton
            activité, avec le nombre de messages envoyés par jour mais jamais leur contenu.
          </li>
          <li>
            <strong>Tes messages privés</strong> ne sont lus que par leurs participants.
          </li>
        </ul>
        <Link href="/dashboard/profile" className={`${buttonOutline} inline-block`}>
          Changer ce que je montre
        </Link>
      </section>

      <section className="glass-card space-y-3 p-6">
        <h2 className="font-display text-lg uppercase">Conditions</h2>
        {accepted ? (
          <p className="font-body text-sm text-paper/80">
            Tu as accepté les <Link href="/cgu" className="text-blue-light underline">conditions d&apos;utilisation</Link> et
            la <Link href="/confidentialite" className="text-blue-light underline">politique de confidentialité</Link> (version
            du {TERMS_DATE}){profile.terms_accepted_at ? `, le ${fmtDate(profile.terms_accepted_at)}` : ""}.
          </p>
        ) : (
          <>
            <p className="font-body text-sm text-paper/80">
              Tu n&apos;as pas encore accepté la version du {TERMS_DATE} des{" "}
              <Link href="/cgu" className="text-blue-light underline">conditions d&apos;utilisation</Link> et de la{" "}
              <Link href="/confidentialite" className="text-blue-light underline">politique de confidentialité</Link>.
            </p>
            <button onClick={acceptTerms} disabled={busy !== null} className={buttonPrimary}>
              {busy === "terms" ? "…" : "J'ai lu et j'accepte"}
            </button>
          </>
        )}
      </section>

      <section className="glass-card space-y-3 border-red/30 p-6">
        <h2 className="font-display text-lg uppercase text-red">Supprimer mon compte</h2>
        {profile.sandbox_expires_at ? (
          <p className="font-body text-sm text-paper/70">C&apos;est un compte de test : il sera effacé automatiquement à son expiration.</p>
        ) : profile.is_founder ? (
          <p className="font-body text-sm text-paper/70">Un compte fondateur ne peut pas être supprimé d&apos;ici : vois avec les autres fondateurs.</p>
        ) : pending ? (
          <>
            <p className="font-body text-sm text-paper/80">
              Demande envoyée le {fmtDate(pending.created_at)}. L&apos;administration la traite sous 30 jours au plus :
              ton dossier, tes messages et ton activité seront alors effacés. Le journal d&apos;audit garde seulement la
              trace de la suppression.
            </p>
            <button onClick={cancelDeletion} disabled={busy !== null} className={buttonOutline}>
              {busy === "cancel" ? "…" : "Annuler ma demande"}
            </button>
          </>
        ) : (
          <>
            <p className="font-body text-sm text-paper/80">
              Ton dossier, tes messages (y compris dans les groupes), ton argent, tes objets et ton activité seront effacés
              sur les trois sites. Les entreprises que tu as fondées seront fermées. Pense à télécharger tes données avant.
            </p>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Pourquoi pars-tu ? (facultatif)"
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <label className="flex items-start gap-2 font-mono text-xs text-paper/80">
              <input type="checkbox" className="mt-0.5 accent-red" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              Je comprends que la suppression est définitive.
            </label>
            <button onClick={requestDeletion} disabled={!understood || busy !== null} className={buttonGhostRed}>
              {busy === "delete" ? "…" : "Demander la suppression de mon compte"}
            </button>
          </>
        )}
        {requests.filter((r) => r.status !== "pending").slice(0, 3).map((r) => (
          <p key={r.id} className="font-mono text-[11px] text-paper/50">
            Demande du {fmtDate(r.created_at)} : {r.status === "cancelled" ? "annulée" : r.status === "refused" ? `refusée${r.note ? ` (« ${r.note} »)` : ""}` : "traitée"}
          </p>
        ))}
      </section>
    </div>
  );
}
