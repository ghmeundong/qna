self.addEventListener("push", (event) => {
  let data = {
    title: "새 알림",
    body: "새 메시지가 도착했습니다.",
    url: "/",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      console.error("Push event data parse failed:", err);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: {
      url: data.url,
    },
    tag: data.tag || "message-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});