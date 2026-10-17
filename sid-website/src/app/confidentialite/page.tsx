import type { Metadata } from "next";
import { Privacy } from "@/components/legal/LegalContent";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Confidentialité · S.I.D." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Confidentialité">
      <Privacy site="quest" />
    </LegalPage>
  );
}
