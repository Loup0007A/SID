import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Construit via `new Uint8Array(length)` plutôt que `Uint8Array.from(...)` :
  // avec les types DOM récents, `.from()` infère un buffer `ArrayBufferLike`
  // (incompatible avec `BufferSource` attendu par `applicationServerKey`),
  // alors que ce constructeur type correctement le buffer en `ArrayBuffer`.
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** Vérifie si CET appareil a déjà un abonnement push actif. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return !!subscription;
}

export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Les notifications push ne sont pas prises en charge par ce navigateur.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Notifications push non configurées côté serveur (clé VAPID manquante).");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permission refusée par le navigateur.");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // Cast explicite : selon la version des types DOM utilisée au build,
    // `Uint8Array` est générique sur son buffer et TS ne peut pas garantir
    // qu'il s'agit d'un `ArrayBuffer` plutôt que d'un `SharedArrayBuffer` —
    // à l'exécution c'est toujours un ArrayBuffer classique ici, donc le
    // cast est sûr.
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Abonnement push incomplet.");
  }

  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}
