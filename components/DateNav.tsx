"use client";

// 日付ナビ（前日 / 今日 / 翌日）。記録・筋トレ画面で共用。
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftDate, todayStr, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui";

export function DateNav({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3">
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label="前日"
        onPress={() => setDate(shiftDate(date, -1))}
      >
        <ChevronLeft size={20} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="min-w-[120px] font-semibold"
        onPress={() => setDate(todayStr())}
      >
        {date === todayStr() ? "今日 " : ""}
        {fmtDate(date)}
      </Button>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label="翌日"
        onPress={() => setDate(shiftDate(date, 1))}
      >
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}
