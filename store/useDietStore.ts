// グローバル状態（Zustand）。DB 全体を保持し、mutate で不変更新→IndexedDB へ保存。
import { create } from "zustand";
import type { DB } from "@/types";
import { loadDB, saveDB } from "@/lib/db";
import { demoDB } from "@/lib/seed";

interface DietState {
  db: DB | null;
  loaded: boolean;
  /** マウント時に1回呼ぶ。保存済みが無ければデモデータで開始。 */
  init: () => Promise<void>;
  /** 不変更新。前状態から次状態を作り、保存する。 */
  mutate: (fn: (prev: DB) => DB) => void;
}

// 複数コンポーネントが同時に init() を呼んでも二重ロードしないためのガード。
let initStarted = false;

export const useDietStore = create<DietState>((set, get) => ({
  db: null,
  loaded: false,
  async init() {
    if (initStarted) return;
    initStarted = true;
    const loaded = await loadDB();
    set({ db: loaded ?? demoDB(), loaded: true });
  },
  mutate(fn) {
    const prev = get().db;
    if (!prev) return;
    const next = fn(prev);
    set({ db: next });
    void saveDB(next);
  },
}));
