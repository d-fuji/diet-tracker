"use client";

// 日付ナビ（前日 / 今日 / 翌日）。記録・筋トレ画面で共用。
// 未来日は記録対象にならないため、翌日ボタンは今日で止める（ホームの収支ナビと同じ挙動）。
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftDate, fmtDate } from "@/lib/format";

export function DateNav({
  date,
  setDate,
  today,
}: {
  date: string;
  setDate: (d: string) => void;
  today: string;
}) {
  const isToday = date === today;
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <button
        onClick={() => setDate(shiftDate(date, -1))}
        className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
        aria-label="前日"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => setDate(today)}
        className="min-w-[110px] text-center text-sm font-semibold text-slate-900"
      >
        {isToday ? "今日 " : ""}
        {fmtDate(date)}
      </button>
      <button
        onClick={() => setDate(shiftDate(date, 1))}
        disabled={isToday}
        className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500 disabled:pointer-events-none disabled:opacity-30"
        aria-label="翌日"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
