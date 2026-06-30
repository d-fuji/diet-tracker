// 計算ロジック（HANDOFF §4）。すべて純関数。プロトタイプの式をそのまま仕様とする。
import type { DB, DayLog, Sex, Profile, Maintenance, TargetPlan } from "@/types";
import { KCAL_PER_KG, TEF_RATE, neatFactor, daysBetween, todayStr, round } from "@/lib/format";

/** 基礎代謝 BMR（Mifflin-St Jeor）。最新体重で計算（痩せれば基礎代謝も下がる）。 */
export function bmrCalc(sex: Sex, age: number, h: number, w: number): number {
  if (!h || !w || !age) return 0;
  const base = 10 * w + 6.25 * h - 5 * age;
  return round(sex === "female" ? base - 161 : base + 5);
}

export const emptyDay = (): DayLog => ({ meals: [], activities: [], workouts: [] });

export const getDay = (db: DB, date: string): DayLog => db.days[date] || emptyDay();

/** その日にユーザー入力があるか（BMRは自動計算なので判定から除外）。 */
export const hasRecord = (day: DayLog): boolean =>
  day.meals.length > 0 || day.activities.length > 0 || day.workouts.length > 0;

/** before 指定時はその日以前で最新。未記録なら null。 */
export function latestWeight(db: DB, before?: string): number | null {
  const log = [...db.weightLog]
    .filter((w) => !before || w.date <= before)
    .sort((a, b) => b.date.localeCompare(a.date));
  return log[0]?.weight ?? null;
}

const num = (v: number): number => (Number.isFinite(v) ? v : 0);

/** その日の食事合計（qty を掛けて算出）。 */
export function sumMeals(day: DayLog): { kcal: number; p: number; f: number; c: number } {
  return day.meals.reduce(
    (a, m) => {
      const q = m.qty ?? 1;
      return {
        kcal: a.kcal + num(m.kcal) * q,
        p: a.p + num(m.p) * q,
        f: a.f + num(m.f) * q,
        c: a.c + num(m.c) * q,
      };
    },
    { kcal: 0, p: 0, f: 0, c: 0 },
  );
}

export const sumActivities = (day: DayLog): number =>
  day.activities.reduce((a, x) => a + num(x.kcal), 0);

/** その日の食事誘発性熱産生（TEF/DIT）= その日の摂取kcal × TEF率。 */
export const dayTef = (day: DayLog): number => sumMeals(day).kcal * TEF_RATE;

/**
 * 指定日の消費カロリー = BMR(その日の体重)×NEAT係数 + 実測活動 + その日のTEF。
 * 維持カロリー(maintenanceKcal)の単日版。日次表示と維持カロリーで式を一致させる。
 */
export function dayBurn(p: Profile, day: DayLog, weightKg: number): number {
  return bmrCalc(p.sex, p.age, p.heightCm, weightKg) * neatFactor(p.activityLevel) + sumActivities(day) + dayTef(day);
}

/** 直近 window 日で食事記録のある日の平均摂取kcal（TEF/DIT の算出用）。記録なしは 0。 */
function avgIntake(db: DB, window = 21): number {
  const dates = Object.keys(db.days)
    .filter((dt) => getDay(db, dt).meals.length > 0)
    .sort()
    .slice(-window);
  if (dates.length === 0) return 0;
  const total = dates.reduce((a, dt) => a + sumMeals(getDay(db, dt)).kcal, 0);
  return total / dates.length;
}

/**
 * 維持カロリー（TDEE）= 基礎代謝×NEAT係数 + 実測した活動 + 食事誘発性熱産生（摂取×TEF率）。
 * - NEAT係数（profile.activityLevel）で「寝てても消費する分＋無意識の日常活動」を表す。
 * - 活動を記録した日が直近21日で5日以上あれば、BMR×NEAT+活動の実測平均を使う（source: "measured"）。
 * - 5日未満は立ち上がり（source: "estimate"）として活動の実測分を省く。
 * - TEF は記録した食事から両モード共通で加算する。
 */
export function maintenanceKcal(db: DB): Maintenance | null {
  const lw = latestWeight(db);
  const p = db.profile;
  if (!p || !lw) return null;
  const neat = neatFactor(p.activityLevel);
  const bmr = bmrCalc(p.sex, p.age, p.heightCm, lw);
  const tef = avgIntake(db) * TEF_RATE;
  const dates = Object.keys(db.days)
    .filter((dt) => getDay(db, dt).activities.length > 0)
    .sort();
  const recent = dates.slice(-21);
  if (recent.length >= 5) {
    const burns = recent.map((dt) => {
      const w = latestWeight(db, dt) ?? lw;
      return bmrCalc(p.sex, p.age, p.heightCm, w) * neat + sumActivities(getDay(db, dt));
    });
    const avg = burns.reduce((a, b) => a + b, 0) / burns.length;
    return { kcal: Math.round(avg + tef), source: "measured", days: recent.length, bmr };
  }
  return { kcal: Math.round(bmr * neat + tef), source: "estimate", days: recent.length, bmr };
}

/**
 * 1日の目標 kcal を目標体重 + 目標期日から逆算。
 * deficit/day = (痩せる量kg × 7200) / 残り日数。目標が BMR を下回らないようクランプ。
 */
export function targetPlan(db: DB): TargetPlan | null {
  const p = db.profile;
  const lw = latestWeight(db);
  if (!p || !lw) return null;
  const m = maintenanceKcal(db);
  if (!m) return null;
  const bmr = m.bmr;
  const kgToLose = Math.max(0, +(lw - p.goalWeight).toFixed(2));
  const reached = lw <= p.goalWeight;
  const maxDeficit = Math.max(0, m.kcal - bmr); // 安全な最大赤字
  const days = p.targetDate ? daysBetween(todayStr(), p.targetDate) : null;
  const hasPlan = !!p.targetDate && days != null && days > 0 && !reached && kgToLose > 0;

  let dailyDeficit = 0;
  let unrealistic = false;
  if (hasPlan && days != null) {
    dailyDeficit = (kgToLose * KCAL_PER_KG) / days;
    if (dailyDeficit > maxDeficit) {
      unrealistic = true;
      dailyDeficit = maxDeficit;
    }
  }
  const target = Math.round(Math.max(m.kcal - dailyDeficit, bmr)); // 基礎代謝が下限
  const minDays =
    kgToLose > 0 && maxDeficit > 0 ? Math.ceil((kgToLose * KCAL_PER_KG) / maxDeficit) : null;

  // PFC 目標（target kcal から）
  const pro = Math.round(lw * 2.0); // 体重×2g
  const fat = Math.round((target * 0.25) / 9); // 総kcalの25%
  const carb = Math.max(0, Math.round((target - pro * 4 - fat * 9) / 4));

  return {
    maintenance: m.kcal,
    source: m.source,
    bmr,
    target,
    dailyDeficit: Math.round(dailyDeficit),
    p: pro,
    f: fat,
    c: carb,
    days,
    kgToLose,
    reached,
    hasPlan,
    unrealistic,
    minDays,
  };
}

/** 指定日の DayLog を不変更新して新しい DB を返す。 */
export const withDay = (d: DB, date: string, fn: (day: DayLog) => DayLog): DB => ({
  ...d,
  days: { ...d.days, [date]: fn(getDay(d, date)) },
});
