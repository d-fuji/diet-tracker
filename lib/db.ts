// 永続化層: IndexedDB（Dexie）。
// アプリは DB 全体をメモリに保持するため、スナップショット1件として保存する。
// スナップショットには schemaVersion を持たせ、読み込み時に検証・移行する（lib/migrate.ts）。
import Dexie, { type Table } from "dexie";
import type { DB } from "@/types";
import { CURRENT_SCHEMA_VERSION, migrateSnapshot } from "@/lib/migrate";

interface Snapshot {
  id: number;
  /** データ形状のバージョン。無印（v1 時代）は undefined。 */
  schemaVersion?: number;
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

/**
 * 保存済みデータを読み込む。未保存なら null。
 * 壊れたデータは InvalidSnapshotError を投げる（呼び出し側でエラー画面を出し、上書きしない）。
 */
export async function loadDB(): Promise<DB | null> {
  if (typeof window === "undefined") return null;
  const row = await getDexie().snapshots.get(SNAP_ID);
  if (!row) return null;
  return migrateSnapshot(row.data, row.schemaVersion ?? 1);
}

export async function saveDB(data: DB): Promise<void> {
  if (typeof window === "undefined") return;
  await getDexie().snapshots.put({ id: SNAP_ID, schemaVersion: CURRENT_SCHEMA_VERSION, data });
}
