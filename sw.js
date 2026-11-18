// Eski şifreli site kapatıldı: bu SW eski önbelleği siler, kendini kaldırır ve açık sekmeleri yeni adrese gönderir.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate("https://imajcad.aliyildiz123.workers.dev/").catch(() => {});
})()));
