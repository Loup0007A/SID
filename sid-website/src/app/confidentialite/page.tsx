import type { Metadata } from "next";
import { Privacy } from "@/components/legal/LegalContent";
import { LegalPage } from "@/components/legal/LegalPage";
import { getBrand } from "@/lib/brand-server";

export const metadata: Metadata = { title: "Confidentialité" };

export default async function PrivacyPage() {
  // Composant serveur : rendu en parallèle de la mise en page, il attend lui-même les noms (Lot 77).
  await getBrand();
  return (
    <LegalPage title="Confidentialité" page="confidentialite">
      <Privacy site="quest" />
    </LegalPage>
  );
}
