import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "収支ダイエット",
  description:
    "カロリー収支を家計簿のように管理。目標体重と期日から逆算した「今日の予算」を示すダイエット記録アプリ。",
  applicationName: "収支ダイエット",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "収支ダイエット",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
