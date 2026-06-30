// 収支ダイエット Service Worker（オフライン対応）。
// データは IndexedDB にあるためサーバ通信は不要。アプリシェルと静的アセットをキャッシュし、
// オフラインでも起動・操作できるようにする。
//
// 方針:
//  - ナビゲーション（HTML）: network-first → 失敗時はキャッシュ済みシェル '/' を返す
//  - 同一オリジンの GET アセット（/_next など）: stale-while-revalidate
//  - 非 GET / 別オリジン: 介入しない（既定の fetch）
//
// キャッシュ名のバージョンを上げると、activate 時に旧キャッシュを破棄して更新できる。

const CACHE = "diet-tracker-v1";
const SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移: ネットワーク優先、オフライン時はシェルにフォールバック。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // 静的アセット: stale-while-revalidate（即キャッシュ返却＋裏で更新）。
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    ),
  );
});
