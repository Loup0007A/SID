"use client";

import clsx from "clsx";
import { ConstructionTape } from "@/components/ConstructionTape";
import { useSuspendedSections, type MaintenanceSection } from "@/lib/maintenance";

/**
 * Service suspendu par l'administration (Modération → maintenance) : même
 * présentation que les simulations « en développement » — bandeau jaune et
 * noir en haut de la page, page grisée et inutilisable. L'administration
 * (manage_users) garde l'accès pour vérifier.
 * Les actions restent de toute façon bloquées côté base.
 */
export function SectionGate({
  section,
  bypass,
  children,
}: {
  section?: MaintenanceSection;
  bypass: boolean;
  children: React.ReactNode;
}) {
  const suspended = useSuspendedSections();
  const state = section ? suspended[section] : undefined;
  if (!state) return <>{children}</>;

  return (
    <div className="space-y-4">
      <ConstructionTape variant="banner" label="Service temporairement suspendu" />
      <p className="glass-card px-4 py-3 text-center font-body text-sm text-paper/80">
        {state.message || "L'administration a mis ce service en pause. Reviens un peu plus tard !"}
        {bypass && <span className="block font-mono text-[11px] text-paper/50">Tu le vois quand même grâce à tes droits d&apos;administration.</span>}
      </p>
      <div
        aria-hidden={!bypass}
        className={clsx(!bypass && "pointer-events-none select-none opacity-40 grayscale")}
      >
        {children}
      </div>
    </div>
  );
}
