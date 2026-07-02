// 収支ダイエット Service Worker（オフライン対応）。
// データは IndexedDB にあるためサーバ通信は不要。アプリシェルと静的アセットをキャッシュし、
// オフラインでも起動・操作できるようにする。
//
// 方針:
//  - ナビゲーション（HTML）: network-first → 失敗時はキャッシュ済みシェル '/' を返す
//  - 同一オリジンの GET アセット（script/style/image/font）: stale-while-revalidate＋件数上限
//  - 非 GET / 別オリジン: 介入しない（既定の fetch）
//  - 更新: 自動 skipWaiting はしない（新旧チャンク混在を避ける）。
//    ページ側（ServiceWorker.tsx）が waiting を検知して更新UIを出し、
//    ユーザー操作で SKIP_WAITING メッセージ → controllerchange でリロードする。
//
// キャッシュ名のバージョンを上げると、activate 時に旧キャッシュを破棄して更新できる。

const CACHE = "diet-tracker-v2";
const SHELL = "/";
// アセットキャッシュの上限。超えたら古いものから捨てる（無制限に肥大させない）。
const MAX_ASSET_ENTRIES = 80;
const CACHEABLE_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SHELL)).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** シェル以外のエントリが上限を超えたら、古い順（keys の先頭）に削除する。 */
async function trimCache(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((req) => new URL(req.url).pathname !== SHELL);
  const excess = assets.length - MAX_ASSET_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(assets[i]);
}

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

  // 静的アセットのみキャッシュ対象（API 的なリクエストや不明な destination は素通し）。
  if (!CACHEABLE_DESTINATIONS.has(request.destination) && !url.pathname.startsWith("/_next/")) return;

  // stale-while-revalidate（即キャッシュ返却＋裏で更新）。
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              cache.put(request, res.clone()).then(() => trimCache(cache));
            }
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    ),
  );
});
