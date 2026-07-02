// グローバル状態（Zustand）。DB 全体を保持し、mutate で不変更新→IndexedDB へ保存。
// 保存はデバウンスして書き込み回数を抑え、タブが隠れる/閉じる時に即時フラッシュする。
import { create } from "zustand";
import type { DB } from "@/types";
import { loadDB, saveDB } from "@/lib/db";
import { defaultDB } from "@/lib/seed";

const SAVE_DELAY_MS = 400;

interface DietState {
  db: DB | null;
  loaded: boolean;
  /** 保存済みデータの読み込みに失敗（データ破損など）。true の間は上書き保存しない。 */
  loadError: boolean;
  /** 直近の保存に失敗（容量不足・プライベートモードなど）。 */
  saveError: boolean;
  /** マウント時に呼ぶ。保存済みが無ければ空データ（シード食品のみ）で開始。再試行可。 */
  init: () => Promise<void>;
  /** 読み込みエラー時の脱出口。保存データを捨てて空データから始める。 */
  resetToDefault: () => void;
  /** 不変更新。前状態から次状態を作り、保存する。 */
  mutate: (fn: (prev: DB) => DB) => void;
}

let initInFlight = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: DB | null = null;
let flushListenerRegistered = false;

export const useDietStore = create<DietState>((set, get) => {
  const persist = (data: DB) => {
    saveDB(data)
      .then(() => {
        if (get().saveError) set({ saveError: false });
      })
      .catch(() => set({ saveError: true }));
  };

  const flushPending = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (pendingSave) {
      const data = pendingSave;
      pendingSave = null;
      persist(data);
    }
  };

  const scheduleSave = (data: DB) => {
    pendingSave = data;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushPending, SAVE_DELAY_MS);
  };

  return {
    db: null,
    loaded: false,
    loadError: false,
    saveError: false,

    async init() {
      if (get().loaded || initInFlight) return;
      initInFlight = true;
      try {
        const data = await loadDB();
        set({ db: data ?? defaultDB(), loaded: true, loadError: false });
        if (!flushListenerRegistered && typeof window !== "undefined") {
          flushListenerRegistered = true;
          // バックグラウンド移行・タブクローズでデバウンス中の保存を落とさない。
          window.addEventListener("pagehide", flushPending);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushPending();
          });
        }
      } catch {
        set({ loadError: true });
      } finally {
        initInFlight = false;
      }
    },

    resetToDefault() {
      const fresh = defaultDB();
      set({ db: fresh, loaded: true, loadError: false });
      persist(fresh);
    },

    mutate(fn) {
      const prev = get().db;
      if (!prev) return;
      const next = fn(prev);
      set({ db: next });
      scheduleSave(next);
    },
  };
});
