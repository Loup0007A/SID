import type { Metadata } from "next";
import { Cgu } from "@/components/legal/LegalContent";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Conditions d'utilisation · S.I.D." };

export default function CguPage() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <Cgu site="quest" />
    </LegalPage>
  );
}
