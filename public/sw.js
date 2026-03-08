// Service Worker for Operação — Push Notifications
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = { title: "Nova Notificação", body: "", data: {} };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: [
            { action: "open", title: "Ver Aprovações" },
            { action: "dismiss", title: "Dispensar" },
        ],
        tag: "sale-notification",
        renotify: true,
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") return;

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            // Focus existing window if any
            for (const client of clients) {
                if (client.url && "focus" in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            return self.clients.openWindow("/");
        })
    );
});
