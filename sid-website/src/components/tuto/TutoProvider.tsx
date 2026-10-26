"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MemberRank } from "@/types/database";
import { DEFAULT_NUMBERS, TOUR, type TutoNumbers } from "@/lib/tuto/content";

// Rien de lourd tant qu'on n'en a pas besoin.
const TutoSpotlight = dynamic(() => import("./TutoSpotlight").then((m) => m.TutoSpotlight), { ssr: false });
const TutoBriefing = dynamic(() => import("./TutoBriefing").then((m) => m.TutoBriefing), { ssr: false });

export type Onboarding = {
  briefing_seen: boolean;
  tour_step: number;
  tour_done: boolean;
  tour_skipped: boolean;
  tips_seen: string[];
  reward_claimed: boolean;
  is_new: boolean;
  steps: Record<string, boolean>;
  steps_done: number;
  reward: number;
  reward_min_steps: number;
  numbers: TutoNumbers;
};

type Me = { nickname: string; rank: MemberRank; avatarUrl: string | null };

type TourState = { index: number; chapterOnly: number | null } | null;

type Ctx = {
  data: Onboarding | null;
  numbers: TutoNumbers;
  me: Me;
  tour: TourState;
  briefingOpen: boolean;
  /** Une astuce rouverte à la main (bouton ?), même déjà vue. */
  forcedTip: string | null;
  refresh: () => Promise<void>;
  startTour: (fromId?: string, chapterOnly?: boolean) => void;
  stopTour: (finished?: boolean) => void;
  goTo: (index: number) => void;
  openBriefing: () => void;
  closeBriefing: (startTour: boolean) => void;
  markTip: (key: string) => void;
  showTip: (key: string | null) => void;
  resetTips: () => void;
  dismissInvite: () => void;
};

const TutoContext = createContext<Ctx | null>(null);

export function useTuto() {
  return useContext(TutoContext);
}

export function TutoProvider({ me, enabled, children }: { me: Me; enabled: boolean; children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Onboarding | null>(null);
  const [tour, setTour] = useState<TourState>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [forcedTip, setForcedTip] = useState<string | null>(null);
  const autoBriefing = useRef(false);

  const refresh = useCallback(async () => {
    const { data: d } = await supabase.rpc("get_onboarding");
    if (d) setData({ ...(d as Onboarding), numbers: { ...DEFAULT_NUMBERS, ...((d as Onboarding).numbers ?? {}) } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const event = useCallback(
    (name: string, value?: string | number) => supabase.rpc("onboarding_event", { p_event: name, p_value: value == null ? null : String(value) }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Les nouveaux agents reçoivent leur dossier d'intégration à leur
  // première arrivée sur l'accueil.
  useEffect(() => {
    if (!data || autoBriefing.current || pathname !== "/dashboard") return;
    if (!data.briefing_seen && data.is_new && !data.tour_done) {
      autoBriefing.current = true;
      setBriefingOpen(true);
    }
  }, [data, pathname]);

  // Une page change pendant la visite : on suit (l'étape mène la danse).
  const step = tour ? TOUR[tour.index] : null;
  useEffect(() => {
    if (step && pathname !== step.route) router.push(step.route, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // On garde l'étape en base pour pouvoir reprendre ailleurs.
  useEffect(() => {
    if (!tour || tour.chapterOnly != null) return;
    const id = setTimeout(() => event("tour_step", tour.index), 600);
    return () => clearTimeout(id);
  }, [tour, event]);

  const startTour = useCallback(
    (fromId?: string, chapterOnly?: boolean) => {
      const i = fromId ? Math.max(0, TOUR.findIndex((s) => s.id === fromId)) : 0;
      setForcedTip(null);
      setBriefingOpen(false);
      setTour({ index: i, chapterOnly: chapterOnly ? TOUR[i].chapter : null });
    },
    []
  );

  const tourRef = useRef(tour);
  tourRef.current = tour;
  const stopTour = useCallback(
    (finished?: boolean) => {
      const t = tourRef.current;
      if (t && t.chapterOnly == null) event(finished ? "tour_done" : "tour_skipped").then(() => refresh());
      setTour(null);
    },
    [event, refresh]
  );

  const goTo = useCallback(
    (index: number) => {
      setTour((t) => {
        if (!t) return t;
        if (index < 0) return t;
        const last = TOUR.length - 1;
        if (index > last) return t;
        if (t.chapterOnly != null && TOUR[index].chapter !== t.chapterOnly) return t;
        return { ...t, index };
      });
    },
    []
  );

  const openBriefing = useCallback(() => {
    setTour(null);
    setBriefingOpen(true);
  }, []);

  const closeBriefing = useCallback(
    (start: boolean) => {
      setBriefingOpen(false);
      event("briefing_seen").then(() => refresh());
      if (start) startTour(data?.tour_step && !data.tour_done ? TOUR[data.tour_step]?.id : undefined);
    },
    [event, refresh, startTour, data]
  );

  const markTip = useCallback(
    (key: string) => {
      setForcedTip(null);
      setData((d) => (d && !d.tips_seen.includes(key) ? { ...d, tips_seen: [...d.tips_seen, key] } : d));
      event("tip_seen", key);
    },
    [event]
  );

  const resetTips = useCallback(() => {
    setData((d) => (d ? { ...d, tips_seen: [] } : d));
    event("tips_reset");
  }, [event]);

  const dismissInvite = useCallback(() => {
    setData((d) => (d ? { ...d, briefing_seen: true } : d));
    event("briefing_seen");
  }, [event]);

  const value = useMemo<Ctx>(
    () => ({
      data: enabled ? data : null,
      numbers: data?.numbers ?? DEFAULT_NUMBERS,
      me,
      tour,
      briefingOpen,
      forcedTip,
      refresh,
      startTour,
      stopTour,
      goTo,
      openBriefing,
      closeBriefing,
      markTip,
      showTip: setForcedTip,
      resetTips,
      dismissInvite,
    }),
    [enabled, data, me, tour, briefingOpen, forcedTip, refresh, startTour, stopTour, goTo, openBriefing, closeBriefing, markTip, resetTips, dismissInvite]
  );

  return (
    <TutoContext.Provider value={value}>
      {children}
      {enabled && tour && <TutoSpotlight />}
      {enabled && briefingOpen && <TutoBriefing />}
    </TutoContext.Provider>
  );
}
