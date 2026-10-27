"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SidIcon } from "@/components/icons/SidIcon";
import type { IconName } from "@/components/icons/sidIcons";
import { useTuto } from "@/components/tuto/TutoProvider";
import { Rich } from "@/components/tuto/Rich";
import { STEPS, TOUR, pct, zenis, type TutoNumbers } from "@/lib/tuto/content";

type Chapter = {
  id: string;
  title: string;
  icon: IconName;
  href?: string;
  tour?: string;
  body: (n: TutoNumbers) => string;
};

const CHAPTERS: Chapter[] = [
  {
    id: "sid",
    title: "Le S.I.D. en bref",
    icon: "idcard",
    tour: "bienvenue",
    body: () =>
      "Le **S.I.D.** (Système International Dictatorial) rassemble ses agents autour de trois sites, avec un seul compte :\n\n**Le Dossier Central** (ici) : quêtes, entraînement, argent, messagerie, titres. **La Cartographie** : le monde, ses régions, ses routes, les plans des villes, les montures. **Le Wiki** : les fiches de tout ce qui a été croisé, découvertes une à une.\n\nL'accueil range chaque page en tuile ; « ← Accueil » en haut te ramène toujours au point de départ. Le **?** en haut de chaque page ouvre l'aide.",
  },
  {
    id: "dossier",
    title: "Ton dossier et ton rang",
    icon: "profile",
    href: "/dashboard/profile",
    tour: "rang",
    body: () =>
      "Ton **dossier** est ta fiche publique : photo, surnom, armes, équipement, présentation. Les autres le voient au Trombinoscope.\n\nTon **rang** va de **E** à **S** (puis **Divin**, réservé à ceux qui ont vaincu le niveau 101 des Donjons). Il change par décision de l'état-major, ou par la **Promotion** de l'arbre technologique (jusqu'à S).\n\nTu peux renseigner ton **anniversaire** (jamais affiché), devenir **invisible**, masquer ta présence en ligne, et activer les **notifications push** pour être prévenu onglet fermé.",
  },
  {
    id: "quetes",
    title: "Les quêtes",
    icon: "scroll",
    href: "/dashboard/quests",
    tour: "types",
    body: () =>
      "Chaque quête a un **rang** (E à S), un **type de contrat** (sa couleur), une récompense en zénis, de la **renommée**, une échéance et parfois un nombre de places limité. Certaines demandent un niveau minimum d'Intelligence, de Puissance, de Technique ou de puissance globale.\n\n**Prendre la mission** t'y inscrit ; tu peux choisir pour qui tu la prends (qui touchera l'argent). La renommée, elle, reste toujours à toi.\n\n**À l'échéance** : assez de participants, et la quête est validée et payée toute seule. Il en manque un seul, ou la quête n'a pas de limite de places ? Son créateur tranche. Sinon, c'est l'échec, et la renommée en jeu est perdue.\n\n**Chaque fiche de quête affiche ce que tu risques** : « +16 si réussie · −8 si échouée ». Ta renommée, ta place au classement et l'historique de chaque gain ou perte sont dans **Mon dossier**.\n\n**La renommée** se calcule comme un classement d'échecs : réussir une quête au-dessus de ton niveau rapporte beaucoup, échouer une quête facile pour toi coûte cher. Le créateur peut aussi fixer un montant.\n\n**Quêtes avec un lieu** : elles ne se prennent **que sur place** (la fiche lance le trajet). Une fois inscrit, reste une heure sur place : la quête est validée toute seule, récompense et renommée comprises.",
  },
  {
    id: "carte",
    title: "La carte et les trajets",
    icon: "map",
    href: "/dashboard/map",
    tour: "position",
    body: () =>
      "La première fois, tu poses ton **point de départ**. Ensuite, impossible de te téléporter : chaque déplacement est un **trajet chronométré** sur les routes, calculé au plus court, étape par étape.\n\nLe trajet continue page fermée, et une notification t'annonce ton arrivée. Pendant un trajet, on ne peut pas en lancer un autre.\n\nLa **Cartographie** ajoute les **montures** à louer (plus rapides, certaines volent), les **cristaux de téléportation**, les plans des villes, les marchés noirs, les territoires… et sans doute d'autres choses.",
  },
  {
    id: "entrainement",
    title: "L'entraînement",
    icon: "brain",
    href: "/dashboard/simulations/donjons",
    tour: "facteurs",
    body: (n) =>
      `Trois facteurs mesurent ta force, de 0 à 100 :\n\n**Intelligence** : la moyenne de trois épreuves, Potions, Énigmes et Problème. **Puissance** : les Donjons (chaque île terminée). **Technique** : les Techniques.\n\nTa **puissance globale** est la moyenne des trois facteurs. Chaque réussite rapporte un point, un échec ne fait rien perdre. Au plus **${n.sim_per_day} résultats par jour**.\n\n**Donjons** : à partir du niveau 10, un gardien qui te tue récupère ses forces ; à partir du niveau 50, chaque mort peut te coûter un membre (**${n.injury_minutes} min** sans Donjons). Face à un gardien trop fort, **demande de l'aide** : un raid s'ouvre, que les autres agents peuvent rejoindre. Au-delà de 90 de Puissance, les gardiens deviennent des dragons.\n\nOn dit qu'un **niveau 101** attend ceux qui ont tout fini, et qu'il fait de ses vainqueurs des **Divins**.`,
  },
  {
    id: "techno",
    title: "L'arbre technologique",
    icon: "tree",
    href: "/dashboard/tech",
    tour: "techno",
    body: () =>
      "Chaque simulation réussie te donne aussi **un point à dépenser**. Trois branches :\n\n**Missions** : primes de mission, puis optimisation fiscale (moins d'impôt), puis niche fiscale (moins de TVA). **Finances** : négociation salariale, puis placements avisés (plus d'intérêts). **Carrière** : la Promotion, un rang de plus.\n\nLes bonus sont versés tout seuls, avec une ligne « Arbre techno : … » dans ton historique. Dépenser ne fait jamais baisser tes facteurs.",
  },
  {
    id: "argent",
    title: "L'argent",
    icon: "coins",
    href: "/dashboard/bank",
    tour: "epargne",
    body: (n) =>
      `La monnaie du S.I.D. est le **zéni (z)**.\n\n**Ce qui rentre** : ton salaire${n.salary ? ` (${zenis(n.salary)} par semaine)` : ""}, les récompenses de quêtes, tes ventes, tes intérêts, tes dividendes.\n\n**Ce qui sort** : un impôt de **${pct(n.wealth_tax)} par semaine** sur ton solde positif, et la **TVA de ${pct(n.vat)}** sur tes ventes. Les deux remplissent une caisse commune, redistribuée chaque semaine.\n\n**Épargne** : **${pct(n.bank_rate)} par jour**, intérêts composés, mais chaque nouveau dépôt relance le décompte.\n\n**Emprunt** : jusqu'à **${zenis(n.max_debt)}**, à **${pct(n.debt_rate)} par jour**. Si les intérêts te font passer sous zéro, la boutique t'est fermée jusqu'à ce que ton solde remonte.\n\n**Bourse** : les actions des entreprises des agents. Le cours suit la valeur réelle de l'entreprise (fonds propres, bénéfices, dividendes), avec de la volatilité et des actualités ; une action se garde au moins **${n.min_holding_minutes} min**. Quand les actions d'une entreprise partent vite, elle en émet de nouvelles.\n\n**Entreprises** (pour ceux qui en ont le droit) : une mise de départ, une trésorerie, des employés, des dividendes à verser… et une population simulée qui achète aussi.`,
  },
  {
    id: "comptoir",
    title: "Le Comptoir",
    icon: "cart",
    href: "/dashboard/shop",
    tour: "boutique",
    body: (n) =>
      `On y achète ce que l'état-major et ses marchands mettent en vente : recherche, filtres (promos, objets à effet, dernières pièces), et une fiche pour chaque objet avec la quantité, le total et ta bourse après achat. Les marchands (membres qui en ont le droit) y vendent leurs propres objets, éventuellement au profit de leur entreprise. L'onglet « Mes achats » garde tout ce que tu as acheté. Le vendeur reverse **${pct(n.vat)}** de TVA.\n\nCertains objets ont un vrai effet, comme effacer d'un coup les délais d'attente des trois simulations. Tes achats sont listés dans ton dossier.`,
  },
  {
    id: "agents",
    title: "Les autres agents",
    icon: "people",
    href: "/dashboard/chat",
    tour: "messagerie",
    body: () =>
      "**Messagerie** : messages privés et groupes, mise en forme (gras, italique, couleur), modification et suppression de tes messages.\n\n**Notifications** : la cloche garde tout ce qui t'arrive ; les notifications push te préviennent même onglet fermé.\n\n**Classement** (puissance, argent, renommée, quêtes), **Trombinoscope**, **Organigramme**, et sur l'accueil, qui est **en ligne maintenant** (et ce qu'il fait, s'il le montre).",
  },
  {
    id: "titres",
    title: "Titres et farces",
    icon: "masks",
    href: "/dashboard/titles",
    tour: "titres",
    body: () =>
      "Douze **titres secrets** : chacun s'obtient d'une façon cachée, que seule une énigme laisse deviner. Chaque grand événement de l'année a aussi **son titre**, à saisir pendant qu'il dure.\n\nUn titre équipé transforme ton dossier et ton nom partout, et donne un **pouvoir de farce** : de quoi rendre la vie d'un autre agent (ou de tout le S.I.D.) un peu plus étrange pendant quelques minutes.\n\nLes garde-fous : le pouvoir ne marche qu'avec son titre équipé, il se recharge, une seule farce à la fois par cible puis un moment de répit, et la cible voit toujours qui la taquine. L'administration peut poser un bouclier.",
  },
  {
    id: "style",
    title: "Te démarquer",
    icon: "palette",
    href: "/dashboard/settings",
    body: () =>
      "Dans **Réglages**, habille ta carte de trombinoscope, ta ligne de classement et ta fiche : couleurs, bordure, lueur, animations, avec un éditeur visuel (ou en CSS pour les curieux). Ton style ne touche que tes propres éléments.\n\nSur ordinateur, tu peux aussi laisser une traînée derrière ton curseur, aux couleurs de la fête du moment.",
  },
  {
    id: "donnees",
    title: "Tes données",
    icon: "padlock",
    href: "/dashboard/privacy",
    body: () =>
      "**Mes données** liste tout ce que le S.I.D. garde sur toi, et te permet de tout télécharger en un fichier. Tes messages ne sont lus que par leurs participants. Tu peux aussi y demander la suppression de ton compte.",
  },
];

const LEXIQUE: [string, string][] = [
  ["Zéni (z)", "La monnaie du S.I.D."],
  ["Rang", "E, D, C, B, A, S, puis Divin. Celui d'un agent, et celui d'une quête (sa difficulté)."],
  ["Renommée", "Ta réputation, gagnée ou perdue dans les quêtes. Elle compte au classement."],
  ["Facteurs", "Intelligence, Puissance, Technique : de 0 à 100, gagnés en simulation."],
  ["Puissance globale", "La moyenne des trois facteurs."],
  ["Bénéficiaire", "Celui qui touche l'argent d'une quête (pas forcément celui qui la fait)."],
  ["Quête localisée", "Une quête liée à un lieu de la carte : elle se prend sur place, et une heure là-bas la valide."],
  ["Raid", "Un appel à l'aide aux Donjons, que les autres agents rejoignent."],
  ["Farce", "Le pouvoir d'un titre équipé, utilisé sur un autre agent."],
  ["Caisse commune", "Ce que rapportent l'impôt et la TVA, redistribué chaque semaine."],
];

const FAQ: [string, string][] = [
  ["Je ne peux pas prendre une mission.", "Elle est complète, ou elle demande un niveau que tu n'as pas encore : la fiche l'indique. Entraîne-toi dans les simulations."],
  ["Je ne peux plus rien acheter.", "Ton solde est négatif (intérêts d'emprunt). Rembourse à la Banque, ou attends tes prochains revenus."],
  ["Mon trajet ne finit pas.", "Il continue même page fermée ; le compte à rebours est sur la page Carte. Une notification t'attend à l'arrivée."],
  ["Une simulation est grisée.", "Elle est en travaux ou suspendue, tu as atteint la limite du jour, ou tu es blessé (Donjons)."],
  ["Une page fait des choses bizarres.", "Un autre agent t'a peut-être fait une farce : une pastille en bas de l'écran dit qui, et pour combien de temps."],
  ["Comment avoir un titre ?", "C'est tout le jeu : lis bien les énigmes de la page Titres."],
];

export default function GuidePage() {
  const tuto = useTuto();
  const supabase = createClient();
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const d = tuto?.data;
  const n = tuto?.numbers;
  const done = d?.steps_done ?? 0;
  const min = d?.reward_min_steps ?? 5;
  const canClaim = !!d && !d.reward_claimed && d.tour_done && done >= min;

  async function claim() {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_onboarding_reward");
    setClaiming(false);
    const r = data as { success?: boolean; amount?: number; error?: string } | null;
    if (error || !r?.success) {
      const why: Record<string, string> = {
        tour_not_done: "Termine d'abord la visite guidée.",
        not_enough_steps: `Il te faut au moins ${min} premiers pas.`,
        already_claimed: "Ta prime a déjà été versée.",
        sandbox: "Pas de prime pour un compte de test.",
      };
      setClaimMsg({ ok: false, text: why[r?.error ?? ""] ?? "Impossible pour le moment." });
    } else {
      setClaimMsg({ ok: true, text: `${zenis(Number(r.amount ?? 0))} versés sur ton compte. Bienvenue, agent.` });
    }
    await tuto?.refresh();
  }

  const ring = (done / STEPS.length) * 100;

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------------- En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">Manuel de l&apos;agent</p>
          <h1 className="font-display text-3xl uppercase tracking-wide sm:text-4xl">Guide du S.I.D.</h1>
          <p className="mt-2 font-body text-paper/75">
            Tout ce qu&apos;un agent doit savoir, chapitre par chapitre. Les chiffres viennent du jeu lui-même : ils sont toujours à jour.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => tuto?.startTour(d && !d.tour_done && d.tour_step > 0 ? TOUR[d.tour_step]?.id : undefined)} className="rounded-lg bg-red px-4 py-2 font-display text-sm uppercase tracking-wide text-ink hover:bg-red-light">
              <SidIcon name="compass" /> {d && !d.tour_done && d.tour_step > 0 ? "Reprendre la visite" : d?.tour_done ? "Refaire la visite" : "Visite guidée"}
            </button>
            <button onClick={() => tuto?.openBriefing()} className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-wide text-paper/80 hover:border-blue hover:text-blue">
              Mon dossier d&apos;intégration
            </button>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4 px-5 py-4">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#D99A9A" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(ring / 100) * 97.4} 97.4`} className="transition-all duration-700" />
          </svg>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-paper/60">Premiers pas</p>
            <p className="font-display text-3xl text-paper">
              {done}
              <span className="text-lg text-paper/65"> / {STEPS.length}</span>
            </p>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- Premiers pas */}
      <section data-tuto="guide-premiers-pas" className="space-y-4">
        <h2 className="font-display text-xl uppercase tracking-wide text-red">Tes premiers pas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => {
            const ok = !!d?.steps[s.key];
            return (
              <Link
                key={s.key}
                href={s.href}
                scroll={false}
                className={`tuto-step group ${ok ? "is-done" : ""}`}
                aria-label={`${s.label}${ok ? " (fait)" : ""}`}
              >
                <span className="tuto-step-check" aria-hidden>
                  {ok ? <SidIcon name="check" size={14} /> : <SidIcon name={s.icon} size={14} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-display uppercase tracking-wide">{s.label}</span>
                  <span className="block font-body text-xs leading-snug opacity-75">{s.detail}</span>
                </span>
                {!ok && <span className="ml-auto shrink-0 self-center font-mono text-sm opacity-60 transition group-hover:translate-x-0.5" aria-hidden>→</span>}
              </Link>
            );
          })}

          {/* La prime */}
          <div className={`tuto-reward ${d?.reward_claimed ? "is-claimed" : canClaim ? "is-ready" : ""}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em]">Prime d&apos;intégration</p>
            <p className="font-display text-2xl">{zenis(d?.reward ?? 1000)}</p>
            {d?.reward_claimed ? (
              <p className="font-body text-xs">Versée. Bienvenue au S.I.D.</p>
            ) : (
              <>
                <ul className="mt-1 space-y-0.5 font-body text-xs">
                  <li>{d?.tour_done ? "✓" : "○"} Terminer la visite guidée</li>
                  <li>
                    {done >= min ? "✓" : "○"} Au moins {min} premier{min > 1 ? "s" : ""} pas ({Math.min(done, min)}/{min})
                  </li>
                </ul>
                <button onClick={claim} disabled={!canClaim || claiming} className="mt-2 w-full rounded-lg bg-ink px-3 py-1.5 font-display text-sm uppercase tracking-wide text-paper disabled:cursor-not-allowed disabled:opacity-40">
                  {claiming ? "Versement…" : "Toucher la prime"}
                </button>
              </>
            )}
            {claimMsg && <p className={`mt-1 font-body text-xs ${claimMsg.ok ? "" : "text-red-dark"}`}>{claimMsg.text}</p>}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Sommaire */}
      <nav aria-label="Sommaire du guide" className="flex flex-wrap gap-2">
        {CHAPTERS.map((c, i) => (
          <a key={c.id} href={`#${c.id}`} className="glass-card flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-paper/80 hover:border-blue/60 hover:text-blue">
            <span className="text-paper/65">{String(i + 1).padStart(2, "0")}</span> {c.title}
          </a>
        ))}
        <a href="#lexique" className="glass-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-paper/80 hover:border-blue/60 hover:text-blue">Lexique</a>
        <a href="#faq" className="glass-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-paper/80 hover:border-blue/60 hover:text-blue">Questions</a>
      </nav>

      {/* ---------------------------------------------------------------- Chapitres */}
      <div className="grid gap-5 lg:grid-cols-2">
        {CHAPTERS.map((c, i) => (
          <section key={c.id} id={c.id} className="glass-card scroll-mt-24 p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <SidIcon name={c.icon} size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/65">Chapitre {String(i + 1).padStart(2, "0")}</p>
                <h2 className="font-display text-xl uppercase tracking-wide">{c.title}</h2>
              </div>
            </div>
            {n && <Rich text={c.body(n)} className="mt-3 space-y-3 font-body text-[15px] leading-relaxed text-paper/85 [&_strong]:text-paper" />}
            {(c.href || c.tour) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                {c.tour && (
                  <button onClick={() => tuto?.startTour(c.tour, true)} className="font-mono text-[11px] uppercase tracking-wide text-blue hover:underline">
                    <SidIcon name="compass" /> Me montrer
                  </button>
                )}
                {c.href && (
                  <Link href={c.href} scroll={false} className="ml-auto font-mono text-[11px] uppercase tracking-wide text-paper/60 hover:text-blue">
                    Ouvrir la page →
                  </Link>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* ---------------------------------------------------------------- Lexique et questions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section id="lexique" className="glass-card scroll-mt-24 p-6">
          <h2 className="font-display text-xl uppercase tracking-wide">Lexique</h2>
          <dl className="mt-3 divide-y divide-white/10">
            {LEXIQUE.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                <dt className="font-mono text-xs uppercase tracking-wide text-blue-light">{k}</dt>
                <dd className="font-body text-sm text-paper/85">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section id="faq" className="glass-card scroll-mt-24 p-6">
          <h2 className="font-display text-xl uppercase tracking-wide">Questions fréquentes</h2>
          <div className="mt-3 divide-y divide-white/10">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-body text-[15px] text-paper">
                  {q}
                  <span className="font-mono text-paper/65 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-1.5 font-body text-sm text-paper/75">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
