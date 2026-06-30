"use client";

// 日付ナビ（前日 / 今日 / 翌日）。記録・筋トレ画面で共用。
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftDate, todayStr, fmtDate } from "@/lib/format";

export function DateNav({ date, setDate }: { date: string; setDate: (d: string) => void }) {
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
        onClick={() => setDate(todayStr())}
        className="min-w-[110px] text-center text-sm font-semibold text-slate-900"
      >
        {date === todayStr() ? "今日 " : ""}
        {fmtDate(date)}
      </button>
      <button
        onClick={() => setDate(shiftDate(date, 1))}
        className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
        aria-label="翌日"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
