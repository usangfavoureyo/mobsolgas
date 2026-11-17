const VERSION = "mobsol-pwa-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const SHELL_URLS = ["/offline.html", "/icons/mobsol-app-icon.svg"];
const MAX_STATIC_ENTRIES = 100;
const MAX_IMAGE_ENTRIES = 40;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

async function cacheResponse(cacheName, request, response, maxEntries) {
  if (!response || !response.ok || response.type === "opaque") return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trimCache(cacheName, maxEntries);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_URLS.map(async (url) => {
      try { const response = await fetch(url, { cache: "reload" }); if (response.ok) await cache.put(url, response); } catch { /* Keep install available when offline. */ }
    }));
    try { const response = await fetch("/", { cache: "reload" }); if (response.ok) await cache.put("/", response); } catch { /* Navigation fallback will use offline.html. */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE]);
    const old = (await caches.keys()).filter((key) => (key === "mobsol-shell-v1" || key.startsWith("mobsol-pwa-")) && !keep.has(key));
    await Promise.all(old.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/image")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cachedShell = await cache.match("/");
      try {
        const response = await Promise.race([
          fetch(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Navigation timeout")), 3500)),
        ]);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        return cachedShell || await cache.match("/offline.html") || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const refresh = fetch(request).then((response) => cacheResponse(STATIC_CACHE, request, response, MAX_STATIC_ENTRIES).then(() => response));
      return cached || await refresh.catch(() => Response.error());
    })());
    return;
  }

  if (url.pathname.startsWith("/images/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try { const response = await fetch(request); await cacheResponse(IMAGE_CACHE, request, response, MAX_IMAGE_ENTRIES); return response; }
      catch { return Response.error(); }
    })());
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "You have a new Mobsol update." }; }
  const title = typeof payload.title === "string" ? payload.title : "Mobsol Gas";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "There’s an update about your Mobsol order.",
    icon: "/icons/mobsol-app-icon.svg",
    badge: "/icons/mobsol-app-icon.svg",
    tag: typeof payload.tag === "string" ? payload.tag : "mobsol-update",
    data: { url: typeof payload.url === "string" ? payload.url : "/?tab=Orders" },
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?tab=Orders", self.location.origin);
  const safeUrl = target.origin === self.location.origin ? target.href : `${self.location.origin}/?tab=Orders`;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) { await client.navigate(safeUrl); return client.focus(); }
    }
    return self.clients.openWindow(safeUrl);
  })());
});
