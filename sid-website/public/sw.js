// Service worker du S.I.D. : notifications push (Lot 64).

// Une nouvelle version prend la main tout de suite (sinon l'ancienne reste
// active tant qu'un onglet est ouvert).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "S.I.D.", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "S.I.D.";
  const options = {
    body: data.body || "",
    icon: "/icons/app-192.png",
    badge: "/icons/app-192.png",
    data: { link: data.link || "/dashboard" },
    // Même conversation : la nouvelle notification remplace l'ancienne, avec un nouveau signal.
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/dashboard";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Un onglet (ou l'app) déjà ouvert : on l'amène sur la bonne page.
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((c) => (c && "navigate" in c && c.url !== target ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
