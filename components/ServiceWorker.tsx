"use client";

// Service Worker の登録と更新通知。layout に置いて全ページで一度だけ登録する。本番のみ有効。
// 新バージョンが waiting になったらトーストを出し、ユーザー操作で切り替えてリロードする
// （自動 skipWaiting は稼働中の画面と新チャンクが混在しうるため行わない）。
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function ServiceWorker() {
  const [waiting, setWaiting] = useState<globalThis.ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      // 新しい SW に切り替わったら一度だけリロードして新アセットで開き直す。
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener("statechange", () => {
              if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
            });
          });
        })
        .catch(() => {
          // 登録失敗は致命的ではない（PWA 機能が無効になるだけ）。
        });
    };
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-md justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
        <span>新しいバージョンがあります</span>
        <button
          onClick={() => waiting.postMessage("SKIP_WAITING")}
          className="flex shrink-0 items-center gap-1 font-semibold text-emerald-300"
        >
          <RefreshCw size={14} />
          更新
        </button>
      </div>
    </div>
  );
}
