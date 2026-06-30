// Web App Manifest（Next.js メタデータルート）。インストール可能な PWA にする。
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "収支ダイエット",
    short_name: "収支ダイエット",
    description:
      "カロリー収支を家計簿のように管理。目標体重と期日から逆算した「今日の予算」を示すダイエット記録アプリ。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#f8fafc",
    lang: "ja",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
