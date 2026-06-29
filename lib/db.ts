// 永続化層: IndexedDB（Dexie）。元の window.storage.get/set 相当。
// アプリは DB 全体をメモリに保持するため、スナップショット1件として保存する。
import Dexie, { type Table } from "dexie";
import type { DB } from "@/types";

interface Snapshot {
  id: number;
  data: DB;
}

class DietDexie extends Dexie {
  snapshots!: Table<Snapshot, number>;

  constructor() {
    super("diet-tracker");
    this.version(1).stores({ snapshots: "id" });
  }
}

const SNAP_ID = 1;
let instance: DietDexie | null = null;

/** ブラウザでのみ Dexie を生成（SSR では呼ばない）。 */
function getDexie(): DietDexie {
  if (!instance) instance = new DietDexie();
  return instance;
}

export async function loadDB(): Promise<DB | null> {
  if (typeof window === "undefined") return null;
  const row = await getDexie().snapshots.get(SNAP_ID);
  return row?.data ?? null;
}

export async function saveDB(data: DB): Promise<void> {
  if (typeof window === "undefined") return;
  await getDexie().snapshots.put({ id: SNAP_ID, data });
}
