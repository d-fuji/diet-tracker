"use client";

// Service Worker を登録するだけのクライアントコンポーネント（UI なし）。
// layout に置いて全ページで一度だけ登録する。本番のみ有効。
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // 登録失敗は致命的ではない（PWA 機能が無効になるだけ）。
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
