"use client";

import dynamic from "next/dynamic";

/**
 * Les composants scellés (titres secrets) en chargement différé : leur code
 * brouillé est lourd à exécuter, il ne doit pas retarder l'affichage des
 * pages. Chacun est téléchargé à part, une fois la page affichée.
 */
export const Sceau1 = dynamic(() => import("@/components/sceaux/s1").then((m) => m.Sceau1), { ssr: false });
export const Sceau2 = dynamic(() => import("@/components/sceaux/s2").then((m) => m.Sceau2), { ssr: false });
export const Sceau3 = dynamic(() => import("@/components/sceaux/s3").then((m) => m.Sceau3), { ssr: false });
export const Sceau4 = dynamic(() => import("@/components/sceaux/s4").then((m) => m.Sceau4), { ssr: false });
export const Sceau5 = dynamic(() => import("@/components/sceaux/s5").then((m) => m.Sceau5), { ssr: false });
export const Sceau7 = dynamic(() => import("@/components/sceaux/s7").then((m) => m.Sceau7), { ssr: false });
export const Sceau8 = dynamic(() => import("@/components/sceaux/s8").then((m) => m.Sceau8), { ssr: false });
export const Sceau9 = dynamic(() => import("@/components/sceaux/s9").then((m) => m.Sceau9), { ssr: false });
export const BirthdayGift = dynamic(() => import("@/components/sceaux/s6").then((m) => m.BirthdayGift), { ssr: false });
export const BirthdaysToday = dynamic(() => import("@/components/sceaux/s6").then((m) => m.BirthdaysToday), { ssr: false });
export const BirthdaySetting = dynamic(() => import("@/components/sceaux/s6").then((m) => m.BirthdaySetting), { ssr: false });
