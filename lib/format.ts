// 日付・数値の純粋ヘルパーと定数（プロトタイプから忠実に移植）。
import type { Slot, Meal, FoodTag, ActivityLevel } from "@/types";

/** 体脂肪 1kg あたりに蓄えられる概算 kcal */
export const KCAL_PER_KG = 7200;

/**
 * NEAT係数（日常の非運動性活動）。基礎代謝に掛けて「寝てても消費する分＋無意識の活動」を表す。
 * 記録した運動（activities）は別途上乗せするので、ここは運動を除いた日常活動だけを控えめに表す。
 */
export const NEAT_FACTORS: Record<ActivityLevel, number> = {
  low: 1.1, // 座り仕事中心・移動少なめ
  normal: 1.2, // 通勤あり・そこそこ歩く（既定）
  high: 1.35, // 立ち仕事・よく動く
  veryhigh: 1.5, // 力仕事
};

export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string }[] = [
  { id: "low", label: "座り仕事中心" },
  { id: "normal", label: "ふつう" },
  { id: "high", label: "立ち仕事・よく動く" },
  { id: "veryhigh", label: "力仕事" },
];

/** 食事誘発性熱産生（TEF/DIT）。摂取kcalの概ね10%が消化に使われる。 */
export const TEF_RATE = 0.1;

/** activityLevel → NEAT係数。未設定は "normal"(1.2)。 */
export const neatFactor = (level?: ActivityLevel): number => NEAT_FACTORS[level ?? "normal"] ?? NEAT_FACTORS.normal;

export const SLOTS: Slot[] = ["朝", "昼", "夜", "間食"];

export const TAGS: { id: FoodTag; label: string; cls: string }[] = [
  { id: "diet", label: "ダイエット向け", cls: "bg-emerald-100 text-emerald-700" },
  { id: "conveni", label: "コンビニ", cls: "bg-sky-100 text-sky-700" },
  { id: "eatout", label: "外食", cls: "bg-amber-100 text-amber-700" },
  { id: "sweets", label: "お菓子", cls: "bg-rose-100 text-rose-700" },
];

/** 衝突しにくい ID。レンダリング中ではなくイベント時/マウント後に呼ぶ前提。 */
export const uid = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const shiftDate = (s: string, n: number): string => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export const fmtDate = (s: string): string => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const w = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${m}/${d}(${w})`;
};

export const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};

export const n = (v: string | number): number => (Number.isFinite(+v) ? +v : 0);
export const round = (v: number): number => Math.round(v);
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** 「サラダチキン 1個」→「サラダチキン」。チップの省スペース表示用。 */
export const shortName = (s: string): string => s.replace(/\s?\d+(個|本|杯|枚|g)$/, "");

export const slotByTime = (): Slot => {
  const h = new Date().getHours();
  if (h < 11) return "朝";
  if (h < 16) return "昼";
  if (h < 21) return "夜";
  return "間食";
};

export const mealSlot = (m: Meal): Slot => (SLOTS.includes(m.slot) ? m.slot : "間食");
