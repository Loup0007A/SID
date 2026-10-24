"use client";

import dynamic from "next/dynamic";
import { useSiteDecor, type SiteDecor } from "@/components/seasonal/siteDecor";

/**
 * Points d'entrée légers des décors d'événement : le code (et les dessins)
 * d'Halloween, de Noël ou des fêtes n'est téléchargé que si l'événement est
 * affiché en ce moment. Hors saison, rien n'est chargé.
 */

const HOLIDAY_KEYS = ["saint_valentin", "poisson_avril", "paques", "premier_mai", "fete_musique", "quatorze_juillet", "armistice"] as const;
export const anyHoliday = (d: SiteDecor | null) => !!d && HOLIDAY_KEYS.some((k) => d[k]);

const HalloweenDecor = dynamic(() => import("./Halloween").then((m) => m.HalloweenDecor), { ssr: false });
const HalloweenGreeting = dynamic(() => import("./Halloween").then((m) => m.HalloweenGreeting), { ssr: false });
const HalloweenLantern = dynamic(() => import("./Halloween").then((m) => m.HalloweenLantern), { ssr: false });
const NoelDecor = dynamic(() => import("./Noel").then((m) => m.NoelDecor), { ssr: false });
const NoelGarland = dynamic(() => import("./Noel").then((m) => m.NoelGarland), { ssr: false });
const NoelGreeting = dynamic(() => import("./Noel").then((m) => m.NoelGreeting), { ssr: false });
const NoelGift = dynamic(() => import("./Noel").then((m) => m.NoelGift), { ssr: false });
const HolidayDecor = dynamic(() => import("./Holidays").then((m) => m.HolidayDecor), { ssr: false });
const HolidayGarland = dynamic(() => import("./Holidays").then((m) => m.HolidayGarland), { ssr: false });
const HolidayGreeting = dynamic(() => import("./Holidays").then((m) => m.HolidayGreeting), { ssr: false });
const HolidayFooter = dynamic(() => import("./Holidays").then((m) => m.HolidayFooter), { ssr: false });
const ChasseDecor = dynamic(() => import("./GrandeChasse").then((m) => m.ChasseDecor), { ssr: false });
const ChasseGarland = dynamic(() => import("./GrandeChasse").then((m) => m.ChasseGarland), { ssr: false });
const ChasseGreeting = dynamic(() => import("./GrandeChasse").then((m) => m.ChasseGreeting), { ssr: false });
const ChasseFooter = dynamic(() => import("./GrandeChasse").then((m) => m.ChasseFooter), { ssr: false });
const ChasseBoard = dynamic(() => import("./GrandeChasse").then((m) => m.ChasseBoard), { ssr: false });

/** Décor de fond (toutes les pages). */
export function SeasonalDecor() {
  const d = useSiteDecor();
  return (
    <>
      {d?.halloween && <HalloweenDecor />}
      {d?.noel && <NoelDecor />}
      {anyHoliday(d) && <HolidayDecor />}
      {d?.grande_chasse && <ChasseDecor />}
    </>
  );
}

/** Guirlande sous la barre du haut du tableau de bord. */
export function SeasonalGarland() {
  const d = useSiteDecor();
  return (
    <>
      {d?.noel && <NoelGarland />}
      {anyHoliday(d) && <HolidayGarland />}
      {d?.grande_chasse && <ChasseGarland />}
    </>
  );
}

/** Phrase d'accueil du tableau de bord. */
export function SeasonalGreeting() {
  const d = useSiteDecor();
  return (
    <>
      {d?.halloween && <HalloweenGreeting />}
      {d?.noel && <NoelGreeting />}
      {anyHoliday(d) && <HolidayGreeting />}
      {d?.grande_chasse && <ChasseGreeting />}
    </>
  );
}

/** Surprise du pied de page. */
export function SeasonalFooter() {
  const d = useSiteDecor();
  return (
    <>
      {d?.halloween && <HalloweenLantern />}
      {d?.noel && <NoelGift />}
      {anyHoliday(d) && <HolidayFooter />}
      {d?.grande_chasse && <ChasseFooter />}
    </>
  );
}

/** Tableau de l'événement sur l'accueil du tableau de bord (Grande Chasse). */
export function SeasonalBoard() {
  const d = useSiteDecor();
  return d?.grande_chasse ? <ChasseBoard /> : null;
}
