import { describe, it, expect } from "vitest";
import { migrateSnapshot, InvalidSnapshotError, CURRENT_SCHEMA_VERSION } from "@/lib/migrate";
import type { DB } from "@/types";

const validDB = (): DB => ({
  profile: null,
  weightLog: [],
  foods: [],
  days: {
    "2026-06-01": {
      meals: [{ id: "1", name: "x", qty: 1, kcal: 100, p: 1, f: 1, c: 1, slot: "breakfast" }],
      activities: [],
      workouts: [],
    },
  },
});

describe("migrateSnapshot", () => {
  it("現行バージョンはそのまま返す", () => {
    const db = validDB();
    expect(migrateSnapshot(db, CURRENT_SCHEMA_VERSION)).toEqual(db);
  });

  it("v1: 日本語スロットをキーへ移行する", () => {
    const v1 = {
      profile: null,
      weightLog: [],
      foods: [],
      days: {
        "2026-06-01": {
          meals: [
            { id: "1", name: "a", qty: 1, kcal: 1, p: 0, f: 0, c: 0, slot: "朝" },
            { id: "2", name: "b", qty: 1, kcal: 1, p: 0, f: 0, c: 0, slot: "昼" },
            { id: "3", name: "c", qty: 1, kcal: 1, p: 0, f: 0, c: 0, slot: "夜" },
            { id: "4", name: "d", qty: 1, kcal: 1, p: 0, f: 0, c: 0, slot: "間食" },
          ],
          activities: [],
          workouts: [],
        },
      },
    };
    const db = migrateSnapshot(v1, 1);
    expect(db.days["2026-06-01"].meals.map((m) => m.slot)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
  });

  it("v1: 不明なスロットは snack に落とす", () => {
    const v1 = {
      ...validDB(),
      days: {
        d: { meals: [{ id: "1", name: "a", qty: 1, kcal: 1, p: 0, f: 0, c: 0, slot: "夜食" }], activities: [], workouts: [] },
      },
    };
    expect(migrateSnapshot(v1, 1).days["d"].meals[0].slot).toBe("snack");
  });

  it("壊れた形は InvalidSnapshotError（黙って捨てない）", () => {
    expect(() => migrateSnapshot(null, 1)).toThrow(InvalidSnapshotError);
    expect(() => migrateSnapshot({ profile: null }, 1)).toThrow(InvalidSnapshotError);
    expect(() => migrateSnapshot({ ...validDB(), weightLog: "x" }, 1)).toThrow(InvalidSnapshotError);
    expect(() =>
      migrateSnapshot({ ...validDB(), days: { d: { meals: "x" } } }, 1),
    ).toThrow(InvalidSnapshotError);
  });
});
