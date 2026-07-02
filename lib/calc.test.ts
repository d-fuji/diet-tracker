import { describe, it, expect } from "vitest";
import {
  bmrCalc,
  goalSnapshot,
  hasRecord,
  latestWeight,
  sumMeals,
  sumActivities,
  maintenanceKcal,
  targetPlan,
  withDay,
  getDay,
  dayBurn,
} from "@/lib/calc";
import { shiftDate, todayStr } from "@/lib/format";
import type { DB, DayLog } from "@/types";

const baseProfile = { sex: "male" as const, age: 32, heightCm: 174, goalWeight: 68, targetDate: null };

/** 最小限の DB を組み立てるヘルパー。 */
function buildDB(over: Partial<DB> = {}): DB {
  return { profile: baseProfile, weightLog: [], foods: [], days: {}, ...over };
}

const day = (over: Partial<DayLog> = {}): DayLog => ({ meals: [], activities: [], workouts: [], ...over });

describe("bmrCalc (Mifflin-St Jeor)", () => {
  it("男性: 10w + 6.25h - 5age + 5", () => {
    // 10*75 + 6.25*174 - 5*32 + 5 = 1682.5 → 1683
    expect(bmrCalc("male", 32, 174, 75)).toBe(1683);
  });
  it("女性: 男性より 166 低い（+5 → -161）", () => {
    expect(bmrCalc("female", 32, 174, 75)).toBe(1683 - 166);
  });
  it("入力欠損なら 0", () => {
    expect(bmrCalc("male", 0, 174, 75)).toBe(0);
    expect(bmrCalc("male", 32, 0, 75)).toBe(0);
    expect(bmrCalc("male", 32, 174, 0)).toBe(0);
  });
});

describe("latestWeight", () => {
  const db = buildDB({
    weightLog: [
      { date: "2026-06-01", weight: 76 },
      { date: "2026-06-10", weight: 75 },
      { date: "2026-06-20", weight: 74 },
    ],
  });
  it("全体の最新", () => expect(latestWeight(db)).toBe(74));
  it("before 以前の最新", () => expect(latestWeight(db, "2026-06-15")).toBe(75));
  it("記録なしは null", () => expect(latestWeight(buildDB())).toBeNull());
});

describe("sumMeals / sumActivities", () => {
  it("qty を掛けて合計", () => {
    const d = day({
      meals: [
        { id: "1", name: "a", qty: 2, kcal: 100, p: 10, f: 5, c: 20, slot: "breakfast" },
        { id: "2", name: "b", qty: 1, kcal: 50, p: 4, f: 1, c: 8, slot: "lunch" },
      ],
    });
    expect(sumMeals(d)).toEqual({ kcal: 250, p: 24, f: 11, c: 48 });
  });
  it("活動合計", () => {
    const d = day({ activities: [{ id: "1", label: "歩", kcal: 200 }, { id: "2", label: "移動", kcal: 120 }] });
    expect(sumActivities(d)).toBe(320);
  });
});

describe("maintenanceKcal", () => {
  it("profile か体重が無ければ null", () => {
    expect(maintenanceKcal(buildDB())).toBeNull();
    expect(maintenanceKcal(buildDB({ profile: null, weightLog: [{ date: todayStr(), weight: 75 }] }))).toBeNull();
  });

  it("活動記録が5日未満なら estimate（BMR×NEAT＋TEF）", () => {
    const db = buildDB({ weightLog: [{ date: todayStr(), weight: 75 }] });
    const m = maintenanceKcal(db)!;
    expect(m.source).toBe("estimate");
    expect(m.bmr).toBe(1683);
    expect(m.kcal).toBe(Math.round(1683 * 1.2)); // 既定NEAT1.2・食事記録なしでTEF0 → 2020
  });

  it("活動記録が5日以上なら measured（実測平均：BMR×NEAT＋活動）", () => {
    const days: DB["days"] = {};
    for (let i = 0; i < 5; i++) {
      days[shiftDate(todayStr(), -i)] = day({ activities: [{ id: String(i), label: "歩", kcal: 300 }] });
    }
    const db = buildDB({ weightLog: [{ date: todayStr(), weight: 75 }], days });
    const m = maintenanceKcal(db)!;
    expect(m.source).toBe("measured");
    expect(m.days).toBe(5);
    expect(m.kcal).toBe(Math.round(1683 * 1.2 + 300)); // BMR(75)×NEAT1.2 + 活動300, 食事なしTEF0 → 2320
  });

  it("NEAT係数は活動量プロフィールで変わる", () => {
    const db = buildDB({
      profile: { ...baseProfile, activityLevel: "high" },
      weightLog: [{ date: todayStr(), weight: 75 }],
    });
    expect(maintenanceKcal(db)!.kcal).toBe(Math.round(1683 * 1.35)); // high=1.35
  });

  it("TEF: 食事記録があれば摂取×10%が加算される", () => {
    const db = buildDB({
      weightLog: [{ date: todayStr(), weight: 75 }],
      days: {
        [todayStr()]: day({
          meals: [{ id: "1", name: "x", qty: 1, kcal: 2000, p: 0, f: 0, c: 0, slot: "breakfast" }],
        }),
      },
    });
    const m = maintenanceKcal(db)!;
    expect(m.source).toBe("estimate"); // 活動記録なし
    expect(m.kcal).toBe(Math.round(1683 * 1.2 + 2000 * 0.1)); // 2020 + 200 = 2220
  });
});

describe("dayBurn (単日の消費＝維持カロリーの単日版)", () => {
  it("BMR×NEAT + 実測活動 + その日のTEF", () => {
    const d = day({
      activities: [{ id: "1", label: "歩", kcal: 300 }],
      meals: [{ id: "1", name: "x", qty: 1, kcal: 2000, p: 0, f: 0, c: 0, slot: "breakfast" }],
    });
    // BMR(75)=1683 ×NEAT1.2 + 活動300 + TEF(2000×0.1=200)
    expect(dayBurn(baseProfile, d, 75)).toBeCloseTo(1683 * 1.2 + 300 + 200);
  });

  it("NEAT係数は活動量で変わる", () => {
    expect(dayBurn({ ...baseProfile, activityLevel: "high" }, day(), 75)).toBeCloseTo(1683 * 1.35);
  });
});

describe("targetPlan", () => {
  it("達成済み（現体重 ≤ 目標）は reached, 赤字0, target=維持", () => {
    const db = buildDB({
      profile: { ...baseProfile, goalWeight: 68 },
      weightLog: [{ date: todayStr(), weight: 67 }],
    });
    const plan = targetPlan(db)!;
    expect(plan.reached).toBe(true);
    expect(plan.hasPlan).toBe(false);
    expect(plan.dailyDeficit).toBe(0);
    expect(plan.target).toBe(plan.maintenance);
  });

  it("期日切れ（過去日）は hasPlan=false, 赤字0", () => {
    const db = buildDB({
      profile: { ...baseProfile, targetDate: shiftDate(todayStr(), -10) },
      weightLog: [{ date: todayStr(), weight: 75 }],
    });
    const plan = targetPlan(db)!;
    expect(plan.hasPlan).toBe(false);
    expect(plan.dailyDeficit).toBe(0);
  });

  it("現実的なペースは赤字を反映し unrealistic=false", () => {
    const db = buildDB({
      profile: { ...baseProfile, targetDate: shiftDate(todayStr(), 200) },
      weightLog: [{ date: todayStr(), weight: 75 }],
    });
    const plan = targetPlan(db)!;
    // 維持=round(1683×1.2)=2020, maxDeficit=2020-1683=337
    // kgToLose=7, deficit/day = 7*7200/200 = 252 ≤ 337
    expect(plan.kgToLose).toBe(7);
    expect(plan.unrealistic).toBe(false);
    expect(plan.dailyDeficit).toBe(252);
    expect(plan.target).toBe(Math.round(plan.maintenance - 252));
  });

  it("無謀ペースは BMR にクランプし unrealistic=true, minDays を提示", () => {
    const db = buildDB({
      profile: { ...baseProfile, targetDate: shiftDate(todayStr(), 30) },
      weightLog: [{ date: todayStr(), weight: 75 }],
    });
    const plan = targetPlan(db)!;
    // deficit/day = 7*7200/30 = 1680 > maxDeficit(842) → クランプ
    expect(plan.unrealistic).toBe(true);
    expect(plan.target).toBe(plan.bmr); // 下限 = 基礎代謝
    expect(plan.minDays).toBe(Math.ceil((7 * 7200) / (plan.maintenance - plan.bmr)));
  });

  it("PFC: P=体重×2, F=target×25%/9, C=残り", () => {
    const db = buildDB({
      profile: { ...baseProfile, targetDate: shiftDate(todayStr(), 100) },
      weightLog: [{ date: todayStr(), weight: 75 }],
    });
    const plan = targetPlan(db)!;
    expect(plan.p).toBe(150);
    expect(plan.f).toBe(Math.round((plan.target * 0.25) / 9));
    expect(plan.c).toBe(Math.max(0, Math.round((plan.target - plan.p * 4 - plan.f * 9) / 4)));
  });
});

describe("hasRecord（収支を表示してよいか）", () => {
  const meal = { id: "1", name: "x", qty: 1, kcal: 100, p: 0, f: 0, c: 0, slot: "breakfast" as const };
  it("食事があれば true", () => {
    expect(hasRecord(day({ meals: [meal] }))).toBe(true);
  });
  it("活動・筋トレだけの日は false（摂取0の大幅赤字として誤表示しない）", () => {
    expect(hasRecord(day({ activities: [{ id: "1", label: "歩", kcal: 200 }] }))).toBe(false);
    expect(hasRecord(day({ workouts: [{ id: "1", ex: "BP", weight: 60, reps: 8, sets: 3 }] }))).toBe(false);
    expect(hasRecord(day())).toBe(false);
  });
});

describe("goalSnapshot", () => {
  const db = buildDB({
    weightLog: [
      { date: "2026-06-01", weight: 77 },
      { date: "2026-06-15", weight: 75 },
      { date: "2026-06-30", weight: 73 },
    ],
  });
  it("開始=最古 / 現在=最新 / done・toGo を算出", () => {
    const s = goalSnapshot(db)!;
    expect(s).toEqual({ start: 77, cur: 73, done: 4, toGo: 5, reached: false });
  });
  it("upto 指定でその日時点の進捗になる", () => {
    const s = goalSnapshot(db, "2026-06-20")!;
    expect(s.cur).toBe(75);
    expect(s.done).toBe(2);
  });
  it("達成済みは reached=true, toGo=0", () => {
    const s = goalSnapshot(buildDB({ weightLog: [{ date: "2026-06-01", weight: 67 }] }))!;
    expect(s.reached).toBe(true);
    expect(s.toGo).toBe(0);
  });
  it("リバウンドで開始より重くても done は 0 未満にならない", () => {
    const s = goalSnapshot(
      buildDB({
        weightLog: [
          { date: "2026-06-01", weight: 75 },
          { date: "2026-06-30", weight: 76 },
        ],
      }),
    )!;
    expect(s.done).toBe(0);
  });
  it("profile か体重が無ければ null", () => {
    expect(goalSnapshot(buildDB())).toBeNull();
    expect(goalSnapshot(buildDB({ profile: null }))).toBeNull();
  });
});

describe("withDay / getDay", () => {
  it("不変更新で指定日の DayLog を差し替える", () => {
    const db = buildDB();
    const next = withDay(db, "2026-06-29", (d) => ({
      ...d,
      activities: [...d.activities, { id: "x", label: "歩", kcal: 100 }],
    }));
    expect(getDay(next, "2026-06-29").activities).toHaveLength(1);
    expect(getDay(db, "2026-06-29").activities).toHaveLength(0); // 元は不変
  });
});
