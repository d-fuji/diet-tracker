// データモデル（HANDOFF §3 準拠）。プロトタイプの `db` オブジェクトをそのまま型に落とす。

export type Sex = "male" | "female";
/** 食事スロット。永続データには言語非依存のキーを保存し、表示名は SLOT_LABELS（lib/constants.ts）で引く。 */
export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export type FoodTag = "diet" | "conveni" | "eatout" | "sweets";

/** 日常の活動量（運動を除く）。NEAT係数のマッピングに使う。 */
export type ActivityLevel = "low" | "normal" | "high" | "veryhigh";

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  goalWeight: number; // kg
  targetDate: string | null; // "YYYY-MM-DD"。痩せるペースの逆算に使用
  activityLevel?: ActivityLevel; // 日常活動量 → NEAT係数。未設定は "normal"(1.2) 扱い
}

export interface WeightEntry {
  date: string; // "YYYY-MM-DD"（1日1件、upsert）
  weight: number; // kg
}

/** 食品DB（UGC）。kcal/p/f/c はすべて「1食分」の値 */
export interface Food {
  id: string;
  name: string; // 分量込み推奨（例「サラダチキン 1個」）
  kcal: number;
  p: number; // タンパク質 g
  f: number; // 脂質 g
  c: number; // 炭水化物 g
  tags: FoodTag[];
}

/** 食事1件。kcal/p/f/c は「1食分の単価」、合計は qty を掛けて算出 */
export interface Meal {
  id: string;
  foodId?: string; // 食品DB由来なら設定。手入力はなし
  name: string;
  qty: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
  slot: Slot;
}

export interface Activity {
  id: string;
  label: string;
  kcal: number; // 消費kcal（手入力 or ウォーキング概算）
}

export interface Workout {
  id: string;
  ex: string; // 種目
  weight: number; // kg
  reps: number;
  sets: number;
  // 注: 消費カロリーには加算しない（ログ専用）
}

export interface DayLog {
  meals: Meal[];
  activities: Activity[];
  workouts: Workout[];
}

export interface DB {
  profile: Profile | null;
  weightLog: WeightEntry[];
  foods: Food[];
  days: Record<string, DayLog>; // キーは "YYYY-MM-DD"
}

/** 不変更新関数。前状態から次状態を作って保存する（store.mutate と同一シグネチャ）。 */
export type Mutate = (fn: (prev: DB) => DB) => void;

/** maintenanceKcal の戻り値 */
export interface Maintenance {
  kcal: number;
  source: "measured" | "estimate";
  days: number;
  bmr: number;
}

/** targetPlan の戻り値 */
export interface TargetPlan {
  maintenance: number;
  source: "measured" | "estimate";
  bmr: number;
  target: number;
  dailyDeficit: number;
  p: number;
  f: number;
  c: number;
  days: number | null;
  kgToLose: number;
  reached: boolean;
  hasPlan: boolean;
  unrealistic: boolean;
  minDays: number | null;
}
