// ドメイン定数（計算・データモデルの核）。表示ヘルパーは lib/format.ts に置く。
import type { Slot, FoodTag, ActivityLevel } from "@/types";

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
export const neatFactor = (level?: ActivityLevel): number =>
  NEAT_FACTORS[level ?? "normal"] ?? NEAT_FACTORS.normal;

/** 食事スロット。永続データには言語非依存のキーを保存し、表示は SLOT_LABELS で引く。 */
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夜",
  snack: "間食",
};

export const TAGS: { id: FoodTag; label: string; cls: string }[] = [
  { id: "diet", label: "ダイエット向け", cls: "bg-emerald-100 text-emerald-700" },
  { id: "conveni", label: "コンビニ", cls: "bg-sky-100 text-sky-700" },
  { id: "eatout", label: "外食", cls: "bg-amber-100 text-amber-700" },
  { id: "sweets", label: "お菓子", cls: "bg-rose-100 text-rose-700" },
];
