import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { getBrand } from "@/lib/brand-server";

/**
 * Test direct des notifications push (Lot 64) : envoie une notification à
 * TOUS les appareils du membre connecté, sans passer par la base (pg_net).
 * Répond avec l'état de la configuration et le résultat par appareil, pour
 * savoir quel maillon casse.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const config = {
    vapid_public: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapid_private: !!process.env.VAPID_PRIVATE_KEY,
    vapid_subject: !!process.env.VAPID_SUBJECT,
    webhook_secret: !!process.env.PUSH_WEBHOOK_SECRET,
    service_key: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  };
  if (!config.vapid_public || !config.vapid_private) {
    return NextResponse.json({ config, error: "vapid_missing", results: [] });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (error) return NextResponse.json({ config, error: "read_failed", detail: error.message, results: [] });
  if (!subs?.length) return NextResponse.json({ config, error: "no_subscription", results: [] });

  const payload = JSON.stringify({
    title: `Test du ${(await getBrand()).name}`,
    body: "Si tu lis ceci sur ton écran, les notifications push fonctionnent.",
    link: "/dashboard/profile",
    tag: "push-test",
  });

  const results = await Promise.all(
    subs.map(async (s) => {
      const host = (() => {
        try {
          return new URL(s.endpoint).host;
        } catch {
          return "?";
        }
      })();
      try {
        const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 600,
          urgency: "high",
        });
        return { host, ok: true, status: r.statusCode };
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        // Abonnement expiré ou révoqué : on le retire.
        if (err.statusCode === 404 || err.statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
        return { host, ok: false, status: err.statusCode ?? null, message: (err.body || err.message || "").slice(0, 200) };
      }
    })
  );

  return NextResponse.json({ config, results });
}
