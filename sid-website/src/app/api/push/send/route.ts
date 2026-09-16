import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@example.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

/**
 * Appelée uniquement par le trigger Postgres `trg_push_on_notification`
 * (via pg_net), jamais directement par le navigateur — protégée par un
 * secret partagé (`x-push-secret`), pas par une session utilisateur.
 */
export async function POST(request: NextRequest) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "Push non configuré (clés VAPID manquantes)." }, { status: 501 });
  }

  const secret = request.headers.get("x-push-secret");
  if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { user_id?: string; title?: string; body?: string; link?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.user_id) {
    return NextResponse.json({ error: "user_id manquant." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", body.user_id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({
    title: body.title || "S.I.D.",
    body: body.body || "",
    link: body.link || "/dashboard",
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    )
  );

  // Nettoie les abonnements expirés/révoqués (410 Gone, 404 Not Found)
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "rejected") {
        const statusCode = (r.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subs[i].id);
        }
      }
    })
  );

  return NextResponse.json({ sent: results.filter((r) => r.status === "fulfilled").length });
}
