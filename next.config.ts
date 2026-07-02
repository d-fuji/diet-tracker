import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 手動の useMemo/useCallback を省く前提（コンポーネントのコメント参照）なので、
  // React Compiler による自動メモ化を有効にする。babel-plugin-react-compiler が必要。
  reactCompiler: true,
  async headers() {
    return [
      {
        // 全ルート共通のセキュリティヘッダー。
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Service Worker は常に最新を取得させる（キャッシュさせない）。
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
