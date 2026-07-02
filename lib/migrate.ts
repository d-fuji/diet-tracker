// 永続データのバージョン管理。
// スナップショットに schemaVersion を持たせ、読み込み時に「検証 → 旧バージョンなら移行」する。
// データ形状を変えるときは CURRENT_SCHEMA_VERSION を上げ、migrateSnapshot に段階移行を足すこと。
import type { DB, DayLog, Slot } from "@/types";
import { SLOTS } from "@/lib/constants";

export const CURRENT_SCHEMA_VERSION = 2;

/** v1（スロットが日本語リテラル）→ v2（言語非依存キー）の対応表。 */
const SLOT_V1_TO_V2: Record<string, Slot> = {
  朝: "breakfast",
  昼: "lunch",
  夜: "dinner",
  間食: "snack",
};

export class InvalidSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSnapshotError";
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * 最低限の構造チェック。全フィールドの精査はせず、
 * 「このまま読むと実行時に確実に壊れる」形だけを弾く。
 */
function assertDBShape(v: unknown): asserts v is DB {
  if (!isObj(v)) throw new InvalidSnapshotError("スナップショットがオブジェクトではありません");
  if (v.profile !== null && !isObj(v.profile))
    throw new InvalidSnapshotError("profile が不正です");
  if (!Array.isArray(v.weightLog)) throw new InvalidSnapshotError("weightLog が不正です");
  if (!Array.isArray(v.foods)) throw new InvalidSnapshotError("foods が不正です");
  if (!isObj(v.days)) throw new InvalidSnapshotError("days が不正です");
  for (const [date, day] of Object.entries(v.days)) {
    if (!isObj(day) || !Array.isArray(day.meals) || !Array.isArray(day.activities) || !Array.isArray(day.workouts))
      throw new InvalidSnapshotError(`days["${date}"] が不正です`);
  }
}

/** v1 → v2: meals[].slot を日本語ラベルからキーに変換する。 */
function migrateV1toV2(db: DB): DB {
  const days: Record<string, DayLog> = {};
  for (const [date, day] of Object.entries(db.days)) {
    days[date] = {
      ...day,
      meals: day.meals.map((m) => {
        const slot = SLOT_V1_TO_V2[m.slot as string] ?? (SLOTS.includes(m.slot) ? m.slot : "snack");
        return { ...m, slot };
      }),
    };
  }
  return { ...db, days };
}

/**
 * 保存済みスナップショットを現行スキーマの DB に変換する。
 * 壊れたデータは InvalidSnapshotError を投げる（黙って捨てて上書き保存しないため）。
 */
export function migrateSnapshot(data: unknown, version: number): DB {
  assertDBShape(data);
  let db: DB = data;
  if (version < 2) db = migrateV1toV2(db);
  return db;
}
