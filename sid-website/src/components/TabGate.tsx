"use client";

import Link from "next/link";
import { isTabHidden } from "@/lib/brand";
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Rubrique retirée du site depuis Modération → Rubriques du site (Lot 77) :
 * la page n'est plus ouverte aux membres. L'équipe la voit encore, avec un
 * bandeau, pour pouvoir la préparer.
 */
export function TabGate({ tab, bypass, children }: { tab?: string; bypass: boolean; children: React.ReactNode }) {
  if (!tab || !isTabHidden(tab)) return <>{children}</>;
  if (bypass) {
    return (
      <div className="space-y-4">
        <p className="glass-card border-[#f0c27a]/50 px-4 py-2 font-mono text-[11px] text-[#f0c27a]">
          <SidIcon name="eye" /> Rubrique masquée aux membres (Modération → Rubriques du site). Tu la vois grâce à tes droits d&apos;administration.
        </p>
        {children}
      </div>
    );
  }
  return (
    <div className="glass-card mx-auto max-w-lg space-y-3 p-6 text-center">
      <p className="font-display text-xl uppercase text-paper">Rubrique fermée</p>
      <p className="font-body text-sm text-paper/70">Cette partie du site n&apos;est pas ouverte pour le moment.</p>
      <Link href="/dashboard" className="inline-block rounded-lg bg-blue px-4 py-2 font-mono text-xs uppercase text-ink hover:bg-blue-light">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
