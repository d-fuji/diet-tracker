"use client";

// HeroUI(v3) は CSS ファースト構成のため、ランタイムで必要なのはテーマ切り替え用の
// next-themes プロバイダのみ。将来ダークモードに対応できるよう class 戦略で持たせておく。
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
