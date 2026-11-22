"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * La Gazette (Lot 97, migration 0123) : l'édition de la semaine, calculée
 * en base par gazette(). Archive : ?semaine=AAAA-MM-JJ (un jour de la
 * semaine voulue). Les comptes invisibles n'y figurent jamais ; un lieu de
 * la Carto que le lecteur n'a pas parcouru reste « inexploré ».
 */

type Membre = { id: string; nickname: string; avatar_url: string | null };
type Edition = {
  semaine: { debut: string; fin: string; numero: number; annee: number; en_cours: boolean; precedente: string; suivante: string | null };
  nouveaux: Membre[];
  quetes: { id: string; title: string; difficulty: string; reward: number | null; heros: string[] }[];
  reputation: (Membre & { gain: number })[];
  bourse: { id: string; name: string; debut: number; fin: number; pct: number }[];
  encheres: { id: string; item: string; quantity: number; price: number; gagnant: string | null }[];
  mariages: { a: string; b: string; a_avatar: string | null; b_avatar: string | null; date: string }[];
  sondages: { id: string; question: string; votants: number; gagnant: string | null; voix: number }[];
  annonces: { title: string; date: string }[];
  wiki?: { category: string; number: number; title: string; image_url: string | null; decouvreur: string | null }[];
  carto?: { id: string | null; name: string | null; type: string | null; decouvreur: string | null }[];
  chiffres: { messages: number; quetes_creees: number; encheres: number; decouvertes: number };
};

const zen = (n: number | null | undefined) => `${Math.round(Number(n ?? 0)).toLocaleString("fr-FR")} ${BRAND.currency.symbol}`;
const jour = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
  new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", opts);
const liste = (noms: string[]) => (noms.length <= 1 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`);
const wikiHref = (c: string, n: number) => `${BRAND.urls.wiki.replace(/\/$/, "")}/${c}/${String(n).padStart(3, "0")}`;
const cartoHref = (id: string) => `${BRAND.urls.map.replace(/\/$/, "")}/carte?lieu=${id}`;

/** La une : le fait le plus marquant de la semaine. */
function laUne(e: Edition): { titre: string; texte: string } | null {
  if (e.mariages.length) {
    const m = e.mariages[0];
    return { titre: `${m.a} et ${m.b} se sont dit oui`, texte: e.mariages.length > 1 ? `Et ${e.mariages.length - 1} autre${e.mariages.length > 2 ? "s" : ""} mariage${e.mariages.length > 2 ? "s" : ""} cette semaine.` : "Le registre des unions compte un couple de plus." };
  }
  const q = e.quetes[0];
  if (q) return { titre: `Quête réussie : ${q.title}`, texte: `${q.heros.length ? `${liste(q.heros)} ${q.heros.length > 1 ? "ont" : "a"} rempli` : "Contrat rempli"} un contrat de rang ${q.difficulty}${q.reward ? `, pour ${zen(q.reward)}` : ""}.` };
  const d = (e.wiki?.length ?? 0) + (e.carto?.length ?? 0);
  if (d) return { titre: `${d} découverte${d > 1 ? "s" : ""} cette semaine`, texte: `${BRAND.wiki} et ${BRAND.map} s'agrandissent : voir la rubrique Découvertes.` };
  const a = e.encheres[0];
  if (a) return { titre: `Adjugé : ${a.item} pour ${zen(a.price)}`, texte: a.gagnant ? `Remporté par ${a.gagnant}.` : "La plus belle vente aux enchères de la semaine." };
  if (e.nouveaux.length) return { titre: `${e.nouveaux.length} nouvelle${e.nouveaux.length > 1 ? "s" : ""} recrue${e.nouveaux.length > 1 ? "s" : ""}`, texte: `Bienvenue à ${liste(e.nouveaux.map((n) => n.nickname))}.` };
  return null;
}

function Rubrique({ titre, icon, children }: { titre: string; icon: React.ComponentProps<typeof SidIcon>["name"]; children: React.ReactNode }) {
  return (
    <section className="gz-rubrique glass-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg uppercase">
        <SidIcon name={icon} size={20} /> {titre}
      </h2>
      {children}
    </section>
  );
}

function Avatar({ src, nom }: { src: string | null; nom: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-9 w-9 flex-none rounded-full object-cover" /> : <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/10 font-display text-sm" aria-hidden>{nom.slice(0, 1)}</span>;
}

function Gazette() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useSearchParams();
  const semaine = params.get("semaine");
  const [ed, setEd] = useState<Edition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    setEd(null);
    supabase.rpc("gazette", { p_jour: semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? semaine : null }).then(({ data, error: e }) => {
      if (!vivant) return;
      if (e) return setError(/gazette|PGRST202/.test(`${e.message} ${e.code}`) ? "La Gazette arrive avec la migration 0123." : e.message);
      setError(null);
      setEd(data as Edition);
    });
    return () => {
      vivant = false;
    };
  }, [supabase, semaine]);

  const aller = (d: string | null) => router.push(d ? `/dashboard/gazette?semaine=${d}` : "/dashboard/gazette");
  const une = ed ? laUne(ed) : null;
  const hausses = ed ? ed.bourse.filter((b) => b.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3) : [];
  const baisses = ed ? ed.bourse.filter((b) => b.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 3) : [];
  const vide =
    ed &&
    !une &&
    !ed.reputation.length &&
    !hausses.length &&
    !baisses.length &&
    !ed.sondages.length &&
    !ed.annonces.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="gz-titre space-y-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red">{BRAND.name}</p>
        <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">La Gazette</h1>
        {ed && (
          <p className="font-body text-sm text-paper/80">
            Semaine {ed.semaine.numero} · du {jour(ed.semaine.debut)} au {jour(ed.semaine.fin, { day: "numeric", month: "long", year: "numeric" })}
            {ed.semaine.en_cours && <span className="ml-2 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase text-encre" style={{ background: "#f2d27a" }}>En cours</span>}
          </p>
        )}
        <nav aria-label="Éditions" className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => ed && aller(ed.semaine.precedente)} disabled={!ed} className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10 disabled:opacity-50">
            ← Semaine précédente
          </button>
          {ed?.semaine.suivante && (
            <button onClick={() => aller(ed.semaine.suivante)} className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10">
              Semaine suivante →
            </button>
          )}
          {ed && !ed.semaine.en_cours && (
            <button onClick={() => aller(null)} className="rounded-lg border border-white/20 px-3 py-2 font-mono text-xs uppercase hover:bg-white/10">
              Cette semaine
            </button>
          )}
        </nav>
      </header>

      {error && <p className="glass-card p-4 font-body text-sm text-red">{error}</p>}
      {!ed && !error && <p className="text-center font-body text-sm text-paper/80">Chargement de l&apos;édition…</p>}

      {ed && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Messages", ed.chiffres.messages],
              ["Quêtes publiées", ed.chiffres.quetes_creees],
              ["Ventes aux enchères", ed.chiffres.encheres],
              ["Découvertes", ed.chiffres.decouvertes],
            ].map(([k, v]) => (
              <div key={k} className="glass-card p-3 text-center">
                <dd className="font-display text-2xl">{Number(v).toLocaleString("fr-FR")}</dd>
                <dt className="font-mono text-[11px] uppercase text-paper/80">{k}</dt>
              </div>
            ))}
          </dl>

          {une && (
            <article className="gz-une glass-card space-y-2 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-red">À la une</p>
              <h2 className="font-display text-2xl uppercase leading-tight sm:text-3xl">{une.titre}</h2>
              <p className="font-body text-base text-paper/85">{une.texte}</p>
            </article>
          )}

          {vide && (
            <p className="glass-card p-6 text-center font-body text-paper/80">
              {ed.semaine.en_cours ? "Rien encore cette semaine : la Gazette se remplit au fil des jours." : "Semaine calme : rien à raconter."}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {ed.nouveaux.length > 0 && (
              <Rubrique titre="Nouvelles recrues" icon="hello">
                <ul className="flex flex-wrap gap-3">
                  {ed.nouveaux.map((m) => (
                    <li key={m.id}>
                      <Link href={`/dashboard/profile/${m.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/10">
                        <Avatar src={m.avatar_url} nom={m.nickname} />
                        <span className="font-body font-semibold">{m.nickname}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}

            {ed.quetes.length > 0 && (
              <Rubrique titre="Quêtes réussies" icon="scroll">
                <ul className="space-y-2">
                  {ed.quetes.map((q) => (
                    <li key={q.id}>
                      <Link href={`/dashboard/quests?quete=${q.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-white/10">
                        <span className="font-body font-semibold">{q.title}</span>
                        <span className="block font-mono text-[11px] text-paper/80">
                          Rang {q.difficulty}
                          {q.reward ? ` · ${zen(q.reward)}` : ""}
                          {q.heros.length > 0 && ` · ${liste(q.heros)}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}

            {ed.reputation.length > 0 && (
              <Rubrique titre="Réputation de la semaine" icon="trophy">
                <ol className="space-y-2">
                  {ed.reputation.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <span className="w-5 font-display text-lg">{i + 1}</span>
                      <Avatar src={m.avatar_url} nom={m.nickname} />
                      <Link href={`/dashboard/profile/${m.id}`} className="font-body font-semibold hover:underline">
                        {m.nickname}
                      </Link>
                      <span className="ml-auto font-mono text-sm">+{m.gain.toLocaleString("fr-FR")}</span>
                    </li>
                  ))}
                </ol>
              </Rubrique>
            )}

            {(hausses.length > 0 || baisses.length > 0) && (
              <Rubrique titre="Bourse" icon="candles">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Plus fortes hausses", hausses],
                    ["Plus fortes baisses", baisses],
                  ].map(([t, l]) =>
                    (l as Edition["bourse"]).length ? (
                      <div key={t as string}>
                        <h3 className="mb-1 font-mono text-[11px] uppercase text-paper/80">{t as string}</h3>
                        <ul className="space-y-1">
                          {(l as Edition["bourse"]).map((b) => (
                            <li key={b.id} className="flex justify-between gap-2 font-body text-sm">
                              <span className="truncate">{b.name}</span>
                              <span className={b.pct > 0 ? "font-mono text-hausse" : "font-mono text-baisse"}>
                                {b.pct > 0 ? "+" : ""}
                                {b.pct.toLocaleString("fr-FR")} %
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                </div>
                <Link href="/dashboard/bourse" className="inline-block py-1 font-mono text-xs uppercase underline">
                  Voir la bourse
                </Link>
              </Rubrique>
            )}

            {ed.encheres.length > 0 && (
              <Rubrique titre="Adjugé" icon="gavel">
                <ul className="space-y-1.5">
                  {ed.encheres.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 font-body text-sm">
                      <span>
                        {a.item}
                        {a.quantity > 1 ? ` ×${a.quantity}` : ""}
                        {a.gagnant && <span className="text-paper/80"> · {a.gagnant}</span>}
                      </span>
                      <span className="font-mono">{zen(a.price)}</span>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}

            {ed.mariages.length > 0 && (
              <Rubrique titre="Carnet blanc" icon="rings">
                <ul className="space-y-2">
                  {ed.mariages.map((m) => (
                    <li key={`${m.a}-${m.b}-${m.date}`} className="flex items-center gap-2 font-body">
                      <Avatar src={m.a_avatar} nom={m.a} />
                      <Avatar src={m.b_avatar} nom={m.b} />
                      <span>
                        {m.a} et {m.b}, le {jour(m.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}

            {ed.sondages.length > 0 && (
              <Rubrique titre="Les urnes ont parlé" icon="ballot">
                <ul className="space-y-2">
                  {ed.sondages.map((s) => (
                    <li key={s.id}>
                      <Link href={`/dashboard/polls?sondage=${s.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-white/10">
                        <span className="font-body font-semibold">{s.question}</span>
                        <span className="block font-mono text-[11px] text-paper/80">
                          {s.votants === 0 ? "Aucun vote" : `En tête : ${s.gagnant} (${s.voix} voix sur ${s.votants} votant${s.votants > 1 ? "s" : ""})`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}

            {((ed.wiki?.length ?? 0) > 0 || (ed.carto?.length ?? 0) > 0) && (
              <Rubrique titre="Découvertes" icon="compass">
                <ul className="space-y-1.5">
                  {(ed.wiki ?? []).map((w) => (
                    <li key={`${w.category}-${w.number}`} className="font-body text-sm">
                      <span aria-hidden>📖 </span>
                      {BRAND.sites.wiki ? (
                        <a href={wikiHref(w.category, w.number)} target="_blank" rel="noopener" className="font-semibold underline-offset-2 hover:underline">
                          {w.title}
                        </a>
                      ) : (
                        <span className="font-semibold">{w.title}</span>
                      )}
                      <span className="text-paper/80"> · {BRAND.wiki}{w.decouvreur ? `, par ${w.decouvreur}` : ""}</span>
                    </li>
                  ))}
                  {(ed.carto ?? []).map((c, i) => (
                    <li key={c.id ?? `inconnu-${i}`} className="font-body text-sm">
                      <span aria-hidden>📍 </span>
                      {c.id && c.name ? (
                        BRAND.sites.map ? (
                          <a href={cartoHref(c.id)} target="_blank" rel="noopener" className="font-semibold underline-offset-2 hover:underline">
                            {c.name}
                          </a>
                        ) : (
                          <span className="font-semibold">{c.name}</span>
                        )
                      ) : (
                        <span className="font-semibold italic">Un lieu que tu n&apos;as pas encore exploré</span>
                      )}
                      <span className="text-paper/80"> · {BRAND.map}{c.decouvreur ? `, par ${c.decouvreur}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}

            {ed.annonces.length > 0 && (
              <Rubrique titre="Annonces" icon="megaphone">
                <ul className="space-y-1.5">
                  {ed.annonces.map((a) => (
                    <li key={`${a.title}-${a.date}`} className="font-body text-sm">
                      <span className="font-semibold">{a.title}</span>
                      <span className="text-paper/80"> · {jour(a.date)}</span>
                    </li>
                  ))}
                </ul>
              </Rubrique>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function GazettePage() {
  return (
    <Suspense fallback={<p className="text-center font-body text-sm text-paper/80">Chargement de l&apos;édition…</p>}>
      <Gazette />
    </Suspense>
  );
}
