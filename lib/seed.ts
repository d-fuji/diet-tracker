// シード食品とデモデータ。プロトタイプの seedFoods / demoDB を移植。
// food.kcal/p/f/c は per ONE serving。meal は qty を別に持つ。
import type { DB, Food, Meal, Slot } from "@/types";
import { uid, todayStr, shiftDate } from "@/lib/format";

/** サンプル食品13件。呼ぶたびに新しい id を発番する。 */
export const makeSeedFoods = (): Food[] => [
  { id: uid(), name: "サラダチキン プレーン 1個", kcal: 114, p: 25, f: 1.5, c: 0, tags: ["diet", "conveni"] },
  { id: uid(), name: "ゆで卵 1個", kcal: 76, p: 6.2, f: 5.2, c: 0.2, tags: ["diet", "conveni"] },
  { id: uid(), name: "プロテイン WPC 1杯", kcal: 120, p: 24, f: 1.5, c: 3, tags: ["diet"] },
  { id: uid(), name: "ブランパン 1個", kcal: 70, p: 5, f: 3, c: 9, tags: ["diet", "conveni"] },
  { id: uid(), name: "焼き鳥 もも塩 1本", kcal: 80, p: 7, f: 5.5, c: 0, tags: ["diet", "conveni"] },
  { id: uid(), name: "おにぎり 鮭 1個", kcal: 180, p: 4, f: 1.5, c: 38, tags: ["conveni"] },
  { id: uid(), name: "素焼きアーモンド 25g", kcal: 150, p: 5, f: 13, c: 4, tags: ["diet", "sweets"] },
  { id: uid(), name: "高カカオチョコ 1枚 5g", kcal: 28, p: 0.4, f: 2.1, c: 1.5, tags: ["sweets"] },
  { id: uid(), name: "牛丼 並盛", kcal: 635, p: 20, f: 23, c: 89, tags: ["eatout"] },
  { id: uid(), name: "焼き魚定食", kcal: 600, p: 35, f: 18, c: 70, tags: ["eatout", "diet"] },
  { id: uid(), name: "オートミール 40g", kcal: 152, p: 5.7, f: 2.7, c: 27, tags: ["diet"] },
  { id: uid(), name: "ギリシャヨーグルト 無糖 1個", kcal: 100, p: 10, f: 0, c: 5, tags: ["diet", "conveni"] },
  { id: uid(), name: "鶏むね 皮なし 100g", kcal: 108, p: 22, f: 1.5, c: 0, tags: ["diet"] },
];

export const defaultDB = (): DB => ({
  profile: null,
  weightLog: [],
  foods: makeSeedFoods(),
  days: {},
});

/** 開発・スクショ用のデモデータ。30日の体重・7日の食事/活動/筋トレを生成。 */
export function demoDB(): DB {
  const foods = makeSeedFoods();
  const F = (nm: string): Food => foods.find((f) => f.name.startsWith(nm))!;
  const meal = (f: Food, qty = 1, slot: Slot = "間食"): Meal => ({
    id: uid(),
    foodId: f.id,
    name: f.name,
    qty,
    kcal: f.kcal,
    p: f.p,
    f: f.f,
    c: f.c,
    slot,
  });

  const weightLog = [];
  for (let i = 29; i >= 0; i--) {
    const dt = shiftDate(todayStr(), -i);
    const trend = 77.6 - (29 - i) * 0.155;
    const wobble = Math.sin((29 - i) * 1.6) * 0.28;
    weightLog.push({ date: dt, weight: +(trend + wobble).toFixed(1) });
  }

  const prot = F("プロテイン");
  const oat = F("オートミール");
  const yog = F("ギリシャ");
  const onigiri = F("おにぎり");
  const chick = F("サラダチキン");
  const mune = F("鶏むね");
  const fish = F("焼き魚");
  const gyudon = F("牛丼");
  const almond = F("素焼き");
  const choco = F("高カカオ");

  const days: DB["days"] = {};
  for (let i = 6; i >= 0; i--) {
    const dt = shiftDate(todayStr(), -i);
    const cheat = i === 2;
    const meals: Meal[] = [meal(prot, 1, "朝"), meal(i % 2 ? oat : yog, 1, "朝")];
    if (i !== 0) {
      meals.push(meal(onigiri, 1, "昼"));
      meals.push(i % 2 ? meal(chick, 1, "昼") : meal(mune, 2, "昼"));
      meals.push(cheat ? meal(gyudon, 1, "夜") : meal(fish, 1, "夜"));
      meals.push(i % 3 ? meal(almond, 1, "間食") : meal(choco, 2, "間食"));
    } else {
      meals.push(meal(onigiri, 1, "昼"), meal(chick, 1, "昼"));
    }
    const activities = [{ id: uid(), label: "ウォーキング", kcal: 200 + (i % 3) * 30 }];
    if (i % 2 === 0 && i !== 0) activities.push({ id: uid(), label: "通勤・移動", kcal: 120 });
    const workouts = [5, 3, 1].includes(i)
      ? [
          { id: uid(), ex: "ベンチプレス", weight: 60, reps: 8, sets: 3 },
          {
            id: uid(),
            ex: i === 3 ? "スクワット" : "ラットプルダウン",
            weight: i === 3 ? 80 : 55,
            reps: 8,
            sets: 3,
          },
        ]
      : [];
    days[dt] = { meals, activities, workouts };
  }

  return {
    profile: { sex: "male", age: 32, heightCm: 174, goalWeight: 68, targetDate: shiftDate(todayStr(), 150), activityLevel: "normal" },
    weightLog,
    foods,
    days,
  };
}
