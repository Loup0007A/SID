import type { Metadata } from "next";
import { Cgu } from "@/components/legal/LegalContent";
import { LegalPage } from "@/components/legal/LegalPage";
import { getBrand } from "@/lib/brand-server";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default async function CguPage() {
  // Composant serveur : rendu en parallèle de la mise en page, il attend lui-même les noms (Lot 77).
  await getBrand();
  return (
    <LegalPage title="Conditions d'utilisation" page="cgu">
      <Cgu site="quest" />
    </LegalPage>
  );
}
