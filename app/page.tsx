"use client";

// アプリシェル: ヘッダー＋4タブ（ホーム/記録/筋トレ/食品）＋ボトムナビ＋設定モーダル。
import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { Home, NotebookPen, Dumbbell, Database, Settings } from "lucide-react";
import { useDietStore } from "@/store/useDietStore";
import { todayStr } from "@/lib/format";
import { HomeScreen } from "@/components/Home";
import { LogScreen } from "@/components/Log";
import { WorkoutScreen } from "@/components/Workout";
import { FoodScreen } from "@/components/Food";
import { SettingsModal } from "@/components/Settings";

type TabId = "home" | "log" | "workout" | "food";

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "log", label: "記録", icon: NotebookPen },
  { id: "workout", label: "筋トレ", icon: Dumbbell },
  { id: "food", label: "食品", icon: Database },
];

export default function App() {
  const db = useDietStore((s) => s.db);
  const loaded = useDietStore((s) => s.loaded);
  const init = useDietStore((s) => s.init);
  const mutate = useDietStore((s) => s.mutate);

  const [tab, setTab] = useState<TabId>("home");
  const [date, setDate] = useState(todayStr());
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  if (!loaded || !db) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-default text-sm text-muted">
        <Spinner size="sm" />
        読み込み中…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-default text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-default/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold tracking-tight">
          <span className="text-accent">収支</span>ダイエット
        </h1>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={() => setSettings(true)}
          className="rounded-full text-muted"
          aria-label="設定"
        >
          <Settings size={20} />
        </Button>
      </header>
      <main className="flex-1">
        {tab === "home" && <HomeScreen db={db} openSettings={() => setSettings(true)} />}
        {tab === "log" && <LogScreen db={db} date={date} setDate={setDate} mutate={mutate} />}
        {tab === "workout" && <WorkoutScreen db={db} date={date} setDate={setDate} mutate={mutate} />}
        {tab === "food" && <FoodScreen db={db} mutate={mutate} />}
      </main>
      <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-border bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {t.label}
            </button>
          );
        })}
      </nav>
      {settings && <SettingsModal db={db} mutate={mutate} onClose={() => setSettings(false)} />}
    </div>
  );
}
