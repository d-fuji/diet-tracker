"use client";

// 「今日」の日付文字列を返すフック。
// PWA を開きっぱなしで日付をまたいでも、フォーカス復帰・タブ表示・1分ごとの
// チェックで最新の「今日」に追従する（useState(todayStr()) の固定化バグ対策）。
import { useEffect, useState } from "react";
import { todayStr } from "@/lib/format";

export function useToday(): string {
  const [today, setToday] = useState(todayStr);

  useEffect(() => {
    const update = () => setToday(todayStr()); // 同じ文字列なら再レンダーされない
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    const timer = setInterval(update, 60_000);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      clearInterval(timer);
    };
  }, []);

  return today;
}
