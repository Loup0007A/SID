"use client";

import { useEffect, useState } from "react";
import { useDeepLink } from "@/lib/deeplink";
import { Chronicles, QuestReports, ReportButton } from "@/components/quests/QuestRp";
import { createClient } from "@/lib/supabase/client";
import { loadCurrentUser, can } from "@/lib/permissions";
import { visibleMembers } from "@/lib/visibility";
import type { Quest, QuestDifficulty, QuestVisibility, ContractType, PermissionKey, Profile, QuestParticipantView } from "@/types/database";
import type { MapPlace, MapRoute, CharacterPosition } from "@/types/map";
import { QuestCard } from "@/components/QuestCard";
import { inputClass, labelClass } from "@/lib/ui";
import { CONTRACT_TYPES } from "@/lib/contractTypes";
import { findShortestPath } from "@/lib/pathfinding";
import { formatStat, unmetRequirements, type MemberCharacteristics } from "@/lib/questRequirements";
import { SidIcon } from "@/components/icons/SidIcon";

type RepPreview = { gain?: number; loss?: number; status?: "validated" | "rejected"; delta?: number };

export default function QuestsPage() {
  const supabase = createClient();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [myQuestIds, setMyQuestIds] = useState<Set<string>>(new Set());
  // Mes rapports de mission (Lot 62), et ma participation rejetée ou non.
  const [myReports, setMyReports] = useState<Map<string, { report: string | null; status: string }>>(new Map());
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    giver: "",
    objectives: "",
    reward: "0",
    difficulty: "D" as QuestDifficulty,
    contractType: "autres" as ContractType,
    deadline: "",
    visibility: "members" as QuestVisibility,
    maxParticipants: "",
    fundedByCreator: true,
    placeId: "",
    reputationReward: "",
    minIntelligence: "",
    minStrength: "",
    minTechnique: "",
    minPower: "",
  });

  // Mes caractéristiques, pour griser les quêtes dont je n'atteins pas les prérequis.
  const [me, setMe] = useState<MemberCharacteristics | null>(null);

  // "Pour qui je prends cette mission" par quête (avant de cliquer sur "Prendre")
  const [beneficiary, setBeneficiary] = useState<Record<string, "self" | string>>({});

  // Panneau de gestion des participants (managers uniquement)
  const [openParticipants, setOpenParticipants] = useState<string | null>(null);
  const [participants, setParticipants] = useState<QuestParticipantView[]>([]);

  // Quêtes expirées "proches" de leur objectif, en attente de décision du créateur
  const [pendingQuests, setPendingQuests] = useState<Quest[]>([]);

  // Carte / itinéraires (intégration sid-map)
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [myPosition, setMyPosition] = useState<CharacterPosition | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  // Renommée en jeu pour moi sur chaque quête : gain si réussie, perte si échouée.
  const [repPreview, setRepPreview] = useState<Record<string, RepPreview>>({});

  // Lien direct vers une quête (palette de recherche) : on la montre et on la fait briller.
  const [focusQuest, setFocusQuest] = useState<string | null>(null);
  // Filtres du tableau (Lot 63).
  const [view, setView] = useState<"toutes" | "dispo" | "miennes">("toutes");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useDeepLink("quete", quests.length > 0, (id) => {
    setFocusQuest(id);
    requestAnimationFrame(() => document.getElementById(`quete-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    setTimeout(() => setFocusQuest((f) => (f === id ? null : f)), 4000);
  });

  async function refresh(uid?: string | null) {
    const activeUserId = uid !== undefined ? uid : userId;

    // Tout part en même temps : un seul aller-retour pour toute la page.
    // Les quêtes accomplies ou échouées ne restent pas affichées sur le
    // panneau principal (uniquement celles encore "ouvertes"/"en cours").
    const [questsRes, countsRes, mineRes, statsRes, powerRes, posRes, pendingRes, repRes] = await Promise.all([
      supabase.from("quests").select("*").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }),
      supabase.rpc("quest_participant_counts"),
      activeUserId ? supabase.from("quest_participants").select("quest_id, report, status").eq("user_id", activeUserId) : null,
      activeUserId ? supabase.from("member_stats").select("intelligence, strength, technique").eq("user_id", activeUserId).maybeSingle() : null,
      activeUserId ? supabase.from("profiles").select("power_score").eq("id", activeUserId).maybeSingle() : null,
      activeUserId ? supabase.from("character_positions").select("*").eq("user_id", activeUserId).maybeSingle() : null,
      supabase.rpc("list_pending_expiry_quests"),
      activeUserId ? supabase.rpc("quest_reputation_preview") : null,
    ]);

    if (questsRes.error) {
      setMessage(`Impossible de charger les quêtes : ${questsRes.error.message}`);
      return;
    }
    setQuests(questsRes.data ?? []);
    setCounts(new Map(((countsRes.data ?? []) as { quest_id: string; participant_count: number }[]).map((c) => [c.quest_id, c.participant_count])));

    if (activeUserId) {
      setMyQuestIds(new Set((mineRes?.data ?? []).map((m) => m.quest_id)));
      setMyReports(new Map(((mineRes?.data ?? []) as { quest_id: string; report: string | null; status: string }[]).map((m) => [m.quest_id, { report: m.report, status: m.status }])));
      const st = statsRes?.data;
      const prof = powerRes?.data;
      setMe({
        intelligence: Number(st?.intelligence ?? 0),
        strength: Number(st?.strength ?? 0),
        technique: Number(st?.technique ?? 0),
        power: Number(prof?.power_score ?? 0),
      });
      setMyPosition((posRes?.data as CharacterPosition) ?? null);
    }

    setPendingQuests((pendingRes.data ?? []) as Quest[]);
    if (repRes && !repRes.error && repRes.data) setRepPreview(repRes.data as Record<string, RepPreview>);
  }

  useEffect(() => {
    (async () => {
      // En parallèle : le profil, la liste des membres, la carte, et
      // l'entretien (quêtes dont la date limite est dépassée — validation
      // auto ou mise en attente de confirmation — et trajet en cours, qui
      // peut arriver à destination ou passer à l'étape suivante).
      const [{ profile, permissions }, { data: m }, { data: p }, { data: r }] = await Promise.all([
        loadCurrentUser(),
        supabase.from("profiles").select("*").eq("status", "active"),
        supabase.from("map_places").select("id, name, type"),
        supabase.from("map_routes").select("*"),
        // Silencieux : sans effet si la migration correspondante manque.
        Promise.resolve(supabase.rpc("process_expired_quests")).catch(() => null),
        Promise.resolve(supabase.rpc("advance_my_travel")).catch(() => null),
      ]);
      setPermissions(permissions);
      setUserId(profile?.id ?? null);
      setMembers(visibleMembers(m ?? [], profile?.id, can(permissions, "manage_users")));
      setPlaces(p ?? []);
      setRoutes((r ?? []) as MapRoute[]);

      await refresh(profile?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.from("quests").insert({
      title: form.title,
      description: form.description,
      giver: form.giver.trim() || null,
      objectives: form.objectives
        .split("\n")
        .map((o) => o.trim().slice(0, 140))
        .filter(Boolean)
        .slice(0, 8),
      reward: Number(form.reward) || 0,
      difficulty: form.difficulty,
      contract_type: form.contractType,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      visibility: form.visibility,
      max_participants: form.maxParticipants ? Number(form.maxParticipants) : null,
      funded_by_creator: form.fundedByCreator,
      place_id: form.placeId || null,
      reputation_reward: form.reputationReward ? Number(form.reputationReward) : null,
      min_intelligence: Number(form.minIntelligence) || 0,
      min_strength: Number(form.minStrength) || 0,
      min_technique: Number(form.minTechnique) || 0,
      min_power: Number(form.minPower) || 0,
      created_by: userId,
    });
    if (error) {
      setMessage(`Échec de la création : ${error.message}`);
      return;
    }
    setShowForm(false);
    setForm({ title: "", description: "", giver: "", objectives: "", reward: "0", difficulty: "D", contractType: "autres", deadline: "", visibility: "members", maxParticipants: "", fundedByCreator: true, placeId: "", reputationReward: "", minIntelligence: "", minStrength: "", minTechnique: "", minPower: "" });
    await refresh();
  }

  async function joinQuest(quest: Quest) {
    if (!userId) return;
    const currentCount = counts.get(quest.id) ?? 0;
    if (quest.max_participants != null && currentCount >= quest.max_participants) {
      setMessage("Cette mission est déjà complète.");
      return;
    }
    if (quest.place_id && (myPosition?.place_id !== quest.place_id || myPosition?.travel_started_at)) {
      const name = places.find((p) => p.id === quest.place_id)?.name;
      setMessage(`Cette quête se prend sur place : rends-toi d'abord à ${name ?? "son lieu"}.`);
      return;
    }
    const missing = unmetRequirements(quest, me);
    if (missing.length > 0) {
      setMessage(`Prérequis non atteints : ${missing.map((r) => `${r.label} ${formatStat(r.min)}`).join(", ")}.`);
      return;
    }
    const choice = beneficiary[quest.id] ?? "self";
    const rewardRecipientId = choice === "self" ? null : choice;

    const { error } = await supabase
      .from("quest_participants")
      .insert({ quest_id: quest.id, user_id: userId, reward_recipient_id: rewardRecipientId });
    if (error) {
      setMessage(`Impossible de prendre la mission : ${error.message}`);
      await refresh();
      return;
    }
    setMessage(rewardRecipientId ? "Mission prise ! Récompense reversée à un autre agent." : "Mission prise !");
    await refresh();
  }

  async function deleteQuest(id: string) {
    if (!confirm("Supprimer définitivement cette quête ?")) return;
    const { error } = await supabase.from("quests").delete().eq("id", id);
    if (error) {
      setMessage(`Impossible de supprimer : ${error.message}`);
      return;
    }
    await refresh();
  }

  async function toggleParticipants(questId: string) {
    if (openParticipants === questId) {
      setOpenParticipants(null);
      return;
    }
    setOpenParticipants(questId);
    const { data, error } = await supabase.rpc("list_quest_participants", { p_quest_id: questId });
    if (error) {
      setMessage(`Impossible de charger les participants : ${error.message}`);
      return;
    }
    setParticipants((data ?? []) as QuestParticipantView[]);
  }

  async function validateOne(questId: string, participantUserId: string) {
    const { error } = await supabase.rpc("validate_quest_participant", { p_quest_id: questId, p_user_id: participantUserId });
    if (error) {
      setMessage(`Échec de la validation : ${error.message}`);
      return;
    }
    await toggleParticipantsForceReload(questId);
    await refresh();
  }

  async function rejectOne(questId: string, participantUserId: string) {
    if (!confirm("Marquer cette participation comme échouée ? Le membre perdra de la renommée.")) return;
    const { error } = await supabase.rpc("reject_quest_participant", { p_quest_id: questId, p_user_id: participantUserId });
    if (error) {
      setMessage(`Échec du rejet : ${error.message}`);
      return;
    }
    await toggleParticipantsForceReload(questId);
    await refresh();
  }

  async function validateAll(questId: string) {
    if (!confirm("Valider cette quête pour TOUS les participants inscrits et la marquer comme terminée ?")) return;
    const { data, error } = await supabase.rpc("validate_quest_all_participants", { p_quest_id: questId });
    if (error) {
      setMessage(`Échec de la validation groupée : ${error.message}`);
      return;
    }
    setMessage(`${data ?? 0} participant(s) récompensé(s), quête marquée comme terminée.`);
    await toggleParticipantsForceReload(questId);
    await refresh();
  }

  async function toggleParticipantsForceReload(questId: string) {
    const { data } = await supabase.rpc("list_quest_participants", { p_quest_id: questId });
    setParticipants((data ?? []) as QuestParticipantView[]);
  }

  async function confirmExpired(questId: string, confirmed: boolean) {
    const { error } = await supabase.rpc("confirm_expired_quest", { p_quest_id: questId, p_confirm: confirmed });
    if (error) {
      setMessage(`Échec : ${error.message}`);
      return;
    }
    setMessage(confirmed ? "Quête validée malgré l'objectif non atteint." : "Quête marquée en échec.");
    await refresh();
  }

  async function launchTravel(quest: Quest) {
    if (!myPosition?.place_id) {
      setMessage("Renseigne d'abord ta position actuelle depuis la page Carte.");
      return;
    }
    if (!quest.place_id) return;
    const plan = findShortestPath(routes, myPosition.place_id, quest.place_id);
    if (!plan) {
      setMessage("Aucun itinéraire connu entre ta position et cette quête.");
      return;
    }
    if (plan.steps.length === 0) {
      setMessage("Tu es déjà sur place !");
      return;
    }
    setLaunchingId(quest.id);
    const { error } = await supabase.rpc("start_travel", {
      p_planned_path: plan.steps.map((s) => ({ route_id: s.route_id, to_place_id: s.to_place_id })),
    });
    setLaunchingId(null);
    if (error) {
      setMessage(`Échec du départ : ${error.message}`);
      return;
    }
    setMessage(`Trajet lancé — arrivée estimée dans ${Math.round(plan.totalMinutes)} min. Suis le compte à rebours sur la page Carte.`);
    await refresh();
  }

  function etaFor(quest: Quest): number | null {
    if (!myPosition?.place_id || !quest.place_id) return null;
    const plan = findShortestPath(routes, myPosition.place_id, quest.place_id);
    return plan ? plan.totalMinutes : null;
  }

  const canManage = can(permissions, "manage_quests");
  // Trajet en cours (à pied, à monture ou en vol, lancé d'ici ou depuis la
  // Cartographie) et sa destination finale, pour savoir vers QUELLE quête
  // précisément on se dirige.
  const isTraveling = !!myPosition?.travel_started_at;
  const travelDestinationPlaceId =
    myPosition?.planned_path && myPosition.planned_path.length > 0
      ? myPosition.planned_path[myPosition.planned_path.length - 1].to_place_id
      : myPosition?.flight_target_place_id ?? null;

  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const shownQuests = quests.filter((q) => {
    if (view === "miennes" && !myQuestIds.has(q.id)) return false;
    if (view === "dispo" && (myQuestIds.has(q.id) || q.status !== "open")) return false;
    if (typeFilter && q.contract_type !== typeFilter) return false;
    if (search.trim()) {
      const hay = norm(`${q.title} ${q.description ?? ""} ${q.giver ?? ""} ${(q.objectives ?? []).join(" ")}`);
      if (!norm(search.trim()).split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="quest-hero">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red">Bureau des missions</p>
          <h1 className="font-display text-3xl uppercase tracking-wide">Tableau des missions</h1>
          <p className="mt-1 max-w-xl font-body text-sm text-paper/75">
            Les ordres de mission du S.I.D. Prends-en une, rends-toi sur place, puis raconte ce que ton personnage a accompli.
          </p>
        </div>
        <dl className="quest-stats">
          <div>
            <dt>Ouvertes</dt>
            <dd>{quests.filter((q) => q.status === "open").length}</dd>
          </div>
          <div>
            <dt>Mes missions</dt>
            <dd>{quests.filter((q) => myQuestIds.has(q.id)).length}</dd>
          </div>
          <div>
            <dt>Rapports à écrire</dt>
            <dd>{quests.filter((q) => myQuestIds.has(q.id) && !myReports.get(q.id)?.report && myReports.get(q.id)?.status !== "rejected").length}</dd>
          </div>
        </dl>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)} className="quest-new-btn">
            {showForm ? "Annuler" : "+ Nouvelle quête"}
          </button>
        )}
      </header>

      {pendingQuests.length > 0 && (
        <div className="glass-card space-y-3 border border-red/50 p-4">
          <h2 className="font-display text-lg uppercase text-red">Décision requise — quêtes expirées proches de l&apos;objectif</h2>
          {pendingQuests.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
              <div>
                <p className="font-display uppercase">{q.title}</p>
                <p className="font-mono text-xs text-paper/60">
                  {counts.get(q.id) ?? 0} / {q.max_participants} participants — échéance dépassée
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => confirmExpired(q.id, true)}
                  className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs uppercase text-ink hover:bg-blue-light"
                >
                  Valider quand même
                </button>
                <button
                  onClick={() => confirmExpired(q.id, false)}
                  className="rounded-lg border border-red px-3 py-1.5 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                >
                  Marquer en échec
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isTraveling && (
        <p className="glass-panel rounded-lg px-4 py-2 font-mono text-xs uppercase text-blue-light">
          <SidIcon name="compass" /> Tu es actuellement en déplacement — suis le compte à rebours sur la page{" "}
          <a href="/dashboard/map" className="underline">Carte</a>.
        </p>
      )}

      <div className="quest-filters">
        <div className="quest-seg" role="group" aria-label="Quelles missions">
          {([
            ["toutes", "Toutes"],
            ["dispo", "Disponibles"],
            ["miennes", "Mes missions"],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={view === k ? "is-on" : ""}>
              {label}
            </button>
          ))}
        </div>
        <label className="quest-search">
          <SidIcon name="magnifier" />
          <span className="sr-only">Chercher une mission</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher une mission, un commanditaire…" />
        </label>
        <div data-tuto="quetes-types" className="quest-types" role="group" aria-label="Type de contrat">
          {CONTRACT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={typeFilter === t.value}
              onClick={() => setTypeFilter((f) => (f === t.value ? null : t.value))}
              className={typeFilter === t.value ? "is-on" : ""}
              style={{ ["--type" as string]: t.color }}
            >
              <span className="dot" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="font-mono text-sm text-red">{message}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Titre</label>
            <input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Commanditaire (facultatif)</label>
            <input
              className={inputClass}
              maxLength={80}
              placeholder="Le Conseil des Marchands, un vieil ermite…"
              value={form.giver}
              onChange={(e) => setForm({ ...form, giver: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Objectifs (un par ligne, 8 au plus)</label>
            <textarea
              rows={3}
              className={inputClass}
              placeholder={"Retrouver le convoi\nRamener le coffre intact"}
              value={form.objectives}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Récompense</label>
            <input type="number" min={0} className={inputClass} value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Renommée gagnée (vide = calcul automatique façon Elo)</label>
            <input
              type="number"
              className={inputClass}
              placeholder="Ex : 20 (laisser vide pour un calcul auto selon le rang et le niveau du membre)"
              value={form.reputationReward}
              onChange={(e) => setForm({ ...form, reputationReward: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Rang</label>
            <select className={inputClass} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as QuestDifficulty })}>
              {["E", "D", "C", "B", "A", "S"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Type de contrat</label>
            <select className={inputClass} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Échéance</label>
            <input type="date" className={inputClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Nombre de places (vide = illimité)</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.maxParticipants}
              onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Visibilité</label>
            <select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as QuestVisibility })}>
              <option value="public">Publique (visible hors du site)</option>
              <option value="members">Membres</option>
              <option value="private">Privée</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Lieu sur la carte (optionnel)</label>
            <select className={inputClass} value={form.placeId} onChange={(e) => setForm({ ...form, placeId: e.target.value })}>
              <option value="">— Non localisée —</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className={labelClass}>Prérequis pour prendre la quête (vide = aucun, 100 max)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["minIntelligence", "Intelligence"],
                  ["minStrength", "Puissance"],
                  ["minTechnique", "Technique"],
                  ["minPower", "Puissance globale"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-wide text-paper/60">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    className={inputClass}
                    placeholder="0"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 font-mono text-xs sm:col-span-2">
            <input
              type="checkbox" className="accent-blue"
              checked={form.fundedByCreator}
              onChange={(e) => setForm({ ...form, fundedByCreator: e.target.checked })}
            />
            La récompense est financée par moi-même (débitée de mon portefeuille à chaque validation). Décoche si c&apos;est le S.I.D. qui finance.
          </label>
          <button type="submit" className="rounded-lg sm:col-span-2 bg-blue py-2 font-display uppercase text-ink hover:bg-blue-light">
            Publier la quête
          </button>
        </form>
      )}

      <div data-tuto="quetes-liste" className="grid grid-cols-1 items-start gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {shownQuests.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-white/15 p-8 text-center font-body text-paper/70">
            Aucune mission ne correspond. {view !== "toutes" || typeFilter || search ? "Essaie d'autres filtres." : "Le tableau est vide pour l'instant."}
          </p>
        )}
        {shownQuests.map((q, qi) => {
          const count = counts.get(q.id) ?? 0;
          const isFull = q.max_participants != null && count >= q.max_participants;
          const alreadyIn = myQuestIds.has(q.id);
          const questPlace = q.place_id ? places.find((p) => p.id === q.place_id) : null;
          const eta = q.place_id ? etaFor(q) : null;
          const isTravelingToThisQuest = isTraveling && !!q.place_id && q.place_id === travelDestinationPlaceId;
          const missing = unmetRequirements(q, me);
          // Une quête liée à un lieu ne se prend qu'une fois arrivé sur place.
          const notHere = !!q.place_id && (myPosition?.place_id !== q.place_id || !!myPosition?.travel_started_at);

          return (
            <div key={q.id} id={`quete-${q.id}`} data-tuto={qi === 0 ? "quete" : undefined} className={`scroll-mt-24 space-y-2 ${focusQuest === q.id ? "quest-focus" : ""}`}>
              <QuestCard quest={q} participantCount={count} />
              <div className="quest-dock">
              <div className="quest-dock-meta">
              {!q.funded_by_creator && <span className="quest-chip">Financée par le S.I.D.</span>}
              <span
                className="quest-chip is-rep"
                title="Renommée calculée selon le rang de la quête et ta renommée actuelle : réussir au-dessus de ton niveau rapporte plus, échouer une quête facile coûte plus."
              >
                <SidIcon name="medal" />{" "}
                {repPreview[q.id]?.status ? (
                  repPreview[q.id].status === "validated" ? (
                    <>
                      Réussie pour toi · <span className="text-blue-light">{(repPreview[q.id].delta ?? 0) >= 0 ? "+" : ""}{repPreview[q.id].delta} de renommée</span>
                    </>
                  ) : (
                    <>
                      Échouée pour toi · <span className="text-red">{repPreview[q.id].delta} de renommée</span>
                    </>
                  )
                ) : repPreview[q.id] ? (
                  <>
                    Renommée : <span className="text-blue-light">+{repPreview[q.id].gain}</span> si réussie ·{" "}
                    <span className="text-red">{repPreview[q.id].loss}</span> si échouée
                  </>
                ) : q.reputation_reward != null ? (
                  `±${q.reputation_reward} de renommée`
                ) : (
                  "Renommée selon ton niveau"
                )}
              </span>
              </div>

              {questPlace && (
                <div className="quest-dock-place">
                  <p className="font-mono text-xs uppercase text-blue-light"><SidIcon name="map" /> {questPlace.name}</p>
                  {isTravelingToThisQuest ? (
                    <p className="rounded border border-blue bg-blue/10 py-1 font-mono text-[10px] uppercase text-blue-light">
                      <SidIcon name="compass" /> En trajet vers cette quête —{" "}
                      <a href="/dashboard/map" className="underline">
                        voir le compte à rebours
                      </a>
                    </p>
                  ) : eta != null ? (
                    <>
                      <p className="font-mono text-[10px] text-paper/60">≈ {Math.round(eta)} min depuis ta position</p>
                      {!isTraveling && eta > 0 && (
                        <button
                          onClick={() => launchTravel(q)}
                          disabled={launchingId === q.id}
                          className="rounded-lg w-full border border-blue py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink disabled:opacity-40"
                        >
                          {launchingId === q.id ? "Départ…" : "Lancer le trajet"}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="font-mono text-[10px] text-paper/65">
                      {myPosition?.place_id ? "Aucun itinéraire connu" : "Renseigne ta position sur la page Carte pour voir le trajet"}
                    </p>
                  )}
                </div>
              )}

              {q.status === "open" && !alreadyIn && (
                <div className="quest-dock-take">
                  <label className="quest-dock-label" htmlFor={`benef-${q.id}`}>Récompense pour</label>
                  <select
                    id={`benef-${q.id}`}
                    className="quest-dock-select"
                    value={beneficiary[q.id] ?? "self"}
                    onChange={(e) => setBeneficiary((b) => ({ ...b, [q.id]: e.target.value }))}
                  >
                    <option value="self">Moi-même</option>
                    {members.filter((m) => m.id !== userId).map((m) => (
                      <option key={m.id} value={m.id}>{m.nickname}</option>
                    ))}
                  </select>
                  {notHere && (
                    <p className="font-mono text-[10px] text-blue-light">
                      <SidIcon name="pin" /> Elle se prend sur place, à {questPlace?.name ?? "son lieu"}
                      {isTravelingToThisQuest ? " : tu es en route." : " : lance le trajet ci-dessus."}
                    </p>
                  )}
                  {missing.length > 0 && (
                    <p className="font-mono text-[10px] text-red-light">
                      Il te manque :{" "}
                      {missing.map((r) => `${r.label} ${formatStat(r.min)} (tu as ${formatStat(Number(me?.[r.key] ?? 0))})`).join(", ")}
                    </p>
                  )}
                  <button
                    onClick={() => joinQuest(q)}
                    disabled={isFull || missing.length > 0 || notHere}
                    className="quest-take-btn"
                  >
                    {isFull ? "Complète" : notHere ? "À prendre sur place" : missing.length > 0 ? "Prérequis non atteints" : "Prendre la mission"}
                  </button>
                </div>
              )}

              {alreadyIn && (
                <p className="quest-chip is-taken">
                  {isTravelingToThisQuest ? <><SidIcon name="compass" /> En route vers la mission</> : <><SidIcon name="check" /> Mission en cours</>}
                </p>
              )}

              {alreadyIn && myReports.get(q.id)?.status !== "rejected" && (
                <ReportButton quest={q} report={myReports.get(q.id)?.report ?? null} onSaved={() => refresh()} />
              )}

              {canManage && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleParticipants(q.id)}
                      className="rounded-lg flex-1 border border-blue py-1 font-mono text-xs uppercase text-blue hover:bg-blue hover:text-ink"
                    >
                      {openParticipants === q.id ? "Masquer les participants" : "Gérer les participants"}
                    </button>
                    <button
                      onClick={() => deleteQuest(q.id)}
                      className="rounded-lg flex-1 border border-red/50 py-1 font-mono text-xs uppercase text-red hover:bg-red hover:text-ink"
                    >
                      Supprimer
                    </button>
                  </div>

                  {openParticipants === q.id && (
                    <div className="glass-card space-y-2 p-3">
                      {participants.length === 0 ? (
                        <p className="font-body text-xs text-paper/60">Aucun participant inscrit.</p>
                      ) : (
                        <>
                          {participants.map((p) => (
                            <div key={p.user_id} className="flex items-center justify-between gap-2 font-mono text-xs">
                              <span>
                                {p.nickname}
                                {p.reward_recipient_nickname && (
                                  <span className="text-paper/60"> → {p.reward_recipient_nickname}</span>
                                )}
                                {p.status === "validated" && <span className="ml-1 text-blue-light">(validé)</span>}
                                {p.status === "rejected" && <span className="ml-1 text-red">(échoué)</span>}
                              </span>
                              {p.status !== "validated" && p.status !== "rejected" && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => validateOne(q.id, p.user_id)}
                                    className="rounded border border-blue px-2 py-0.5 uppercase text-blue hover:bg-blue hover:text-ink"
                                  >
                                    Valider
                                  </button>
                                  <button
                                    onClick={() => rejectOne(q.id, p.user_id)}
                                    className="rounded border border-red px-2 py-0.5 uppercase text-red hover:bg-red hover:text-ink"
                                  >
                                    Rejeter
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          <QuestReports questId={q.id} version={participants.length} />
                          <button
                            onClick={() => validateAll(q.id)}
                            className="rounded-lg w-full bg-blue py-1 font-mono text-xs uppercase text-ink hover:bg-blue-light"
                          >
                            Tout valider (marque la quête terminée)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>

      <Chronicles />
    </div>
  );
}
