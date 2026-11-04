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

/** iPhone/iPad (pas les Mac, qui remontent aussi "Mac" mais sans support tactile multipoint). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua);
  const isIpadOsDesktopUa = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleTouch || isIpadOsDesktopUa;
}

/** Le site est-il ouvert en tant qu'app installée (icône sur l'écran d'accueil) ? */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

/**
 * Apple n'autorise les notifications push (et l'API Notification en
 * général) que pour un site ajouté à l'écran d'accueil et ouvert depuis
 * cette icône — jamais pour un onglet Safari classique, même avec la
 * permission accordée. Cette fonction dit si on est dans ce cas précis :
 * iOS, mais PAS encore installé.
 */
export function needsIosInstallFirst(): boolean {
  return isIos() && !isStandaloneDisplay();
}

/** Enregistre le service worker le plus tôt possible (pas besoin d'attendre l'abonnement push pour ça). */
export async function registerServiceWorker(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    // silencieux : pas grave si ça échoue ici, subscribeToPush retentera
  }
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

/** La clé publique de l'abonnement existant est-elle la clé actuelle du site ? */
function sameKey(sub: PushSubscription, key: Uint8Array) {
  const cur = sub.options?.applicationServerKey;
  if (!cur) return true; // navigateur qui ne la donne pas : on garde l'abonnement
  const a = new Uint8Array(cur);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

/** Enregistre l'abonnement de cet appareil pour le membre connecté. */
async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Abonnement push incomplet.");
  }
  const supabase = createClient();
  // push_subscribe (migration 0079) reprend l'appareil s'il était à un autre compte.
  const { data, error } = await supabase.rpc("push_subscribe", { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
  if (!error && !(data as { error?: string } | null)?.error) return;
  // Repli (migration pas encore lancée).
  const { data: auth } = await supabase.auth.getUser();
  const { error: e2 } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: auth.user?.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: "endpoint" });
  if (e2) throw e2;
}

/**
 * Active les notifications sur cet appareil. À appeler DIRECTEMENT dans le
 * clic du bouton : Safari (iPhone) n'affiche la demande d'autorisation que
 * si elle part tout de suite après le geste, avant toute autre attente.
 */
export async function subscribeToPush(_userId?: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Ce navigateur ne gère pas les notifications push.");
  }
  if (needsIosInstallFirst()) {
    throw new Error("Sur iPhone : ajoute d'abord le site à l'écran d'accueil, puis ouvre-le depuis cette icône.");
  }
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Notifications push non configurées sur le serveur (clé VAPID publique absente sur Vercel).");
  }

  // 1. L'autorisation d'abord, dans le geste de l'utilisateur.
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Les notifications sont bloquées pour ce site : autorise-les dans les réglages du navigateur (ou de l'iPhone : Réglages → Notifications → S.I.D.)."
        : "Autorisation non accordée."
    );
  }

  // 2. Le service worker, puis l'abonnement.
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, key)) {
    // Clés du site changées : l'ancien abonnement ne recevrait plus rien.
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // Cast : à l'exécution c'est toujours un ArrayBuffer classique.
    applicationServerKey: key as BufferSource,
  });

  await saveSubscription(subscription);
}

/**
 * Au chargement du site (une fois par jour au plus) : si cet appareil a un
 * abonnement, on le renvoie au serveur. Il revient ainsi s'il avait été
 * effacé, ou s'il appartenait à un autre compte sur le même appareil.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== "granted") return;
  try {
    const last = Number(localStorage.getItem("sid-push-sync") || 0);
    if (Date.now() - last < 24 * 3600_000) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await saveSubscription(subscription);
    localStorage.setItem("sid-push-sync", String(Date.now()));
  } catch {
    /* silencieux : sans conséquence pour la page */
  }
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
