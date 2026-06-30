# 収支ダイエット — 引き継ぎドキュメント

このドキュメントは、プロトタイプ（単一ファイルの React アーティファクト `diet-tracker.jsx`）を **Claude Code で Next.js + TypeScript + PWA 版に移植・継続開発**するための仕様書です。`diet-tracker.jsx` 本体が「動く仕様書」なので、このドキュメントと合わせて渡してください。

---

## 1. アプリ概要

カロリー収支（摂取 vs 消費）を家計簿のように管理する、ダイエッター向けの記録アプリ。コンセプトは「**記録するだけのトラッカーではなく、目標体重と期日から逆算した"今日の予算"を示すツール**」。

中心思想:
- 体脂肪 1kg ≒ 7,200kcal。目標体重と期日から逆算して 1 日の必要赤字を出す。
- 維持カロリー(TDEE)は **基礎代謝×NEAT係数 + 実測した活動 + 食事誘発性熱産生(TEF)** で出す。NEAT係数は日常活動量（`profile.activityLevel`）で可変（旧仕様の実測主義からの方針転換。詳細は §4.2 / §6-1）。
- 食事記録が最重要かつ最も面倒 → ここを最速で打てる UI にする。

---

## 2. ターゲット技術スタック

| 項目 | 採用 |
| --- | --- |
| フレームワーク | Next.js (App Router) + TypeScript |
| スタイル | Tailwind CSS |
| 状態管理 | Zustand |
| 永続化 | IndexedDB（Dexie 推奨）。※ローカル完結。クラウド同期する場合は §8 参照 |
| PWA | next-pwa（モバイルファースト、オフライン動作） |
| グラフ | recharts（プロトと同じ） |
| アイコン | lucide-react |

> **重要**: プロトは claude.ai アーティファクト専用の `window.storage` を使っている。これは移植先では動かないので、**保存層は IndexedDB 等に差し替える**こと（データ構造はそのまま流用可）。

---

## 3. データモデル

プロトの `db` オブジェクトをそのまま型定義に落とす。

```typescript
type Sex = "male" | "female";
type Slot = "朝" | "昼" | "夜" | "間食";
type FoodTag = "diet" | "conveni" | "eatout" | "sweets";

interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  goalWeight: number;       // kg
  targetDate: string | null; // "YYYY-MM-DD"。痩せるペースの逆算に使用
}

interface WeightEntry {
  date: string;  // "YYYY-MM-DD"（1日1件、upsert）
  weight: number; // kg
}

// 食品DB（UGC）。kcal/p/f/c はすべて「1食分」の値
interface Food {
  id: string;
  name: string;     // 分量込み推奨（例「サラダチキン 1個」）
  kcal: number;
  p: number;        // タンパク質 g
  f: number;        // 脂質 g
  c: number;        // 炭水化物 g
  tags: FoodTag[];
  // 将来: favorite?: boolean（§7 バックログ）
}

// 食事1件。kcal/p/f/c は「1食分の単価」、合計は qty を掛けて算出
interface Meal {
  id: string;
  foodId?: string;  // 食品DB由来なら設定。手入力はなし
  name: string;
  qty: number;
  kcal: number; p: number; f: number; c: number;
  slot: Slot;
}

interface Activity {
  id: string;
  label: string;
  kcal: number;     // 消費kcal（手入力 or ウォーキング概算）
}

interface Workout {
  id: string;
  ex: string;       // 種目
  weight: number;   // kg
  reps: number;
  sets: number;
  // 注: 消費カロリーには加算しない（ログ専用）
}

interface DayLog {
  meals: Meal[];
  activities: Activity[];
  workouts: Workout[];
}

interface DB {
  profile: Profile | null;
  weightLog: WeightEntry[];
  foods: Food[];
  days: Record<string, DayLog>; // キーは "YYYY-MM-DD"
}
```

---

## 4. 計算ロジック（純関数として `lib/` に切り出し、ユニットテスト推奨）

すべて `lib/calc.ts` 等に純関数で実装し、テストで守る。以下はプロトの実装そのまま。

### 4.1 基礎代謝 BMR（Mifflin-St Jeor）
最新の体重を使う（痩せれば基礎代謝も下がる）。
```
男性: 10*weightKg + 6.25*heightCm - 5*age + 5
女性: 10*weightKg + 6.25*heightCm - 5*age - 161
```

### 4.2 維持カロリー（maintenance / TDEE）
維持カロリー = 基礎代謝×NEAT係数 + 実測した活動 + 食事誘発性熱産生(TEF)。
NEAT係数は「寝てても消費する分＋無意識の日常活動」を表し、`profile.activityLevel` で可変。
```
NEAT係数(NEAT_FACTORS): low 1.1 / normal 1.2(既定) / high 1.35 / veryhigh 1.5
TEF_RATE = 0.10                         // 食事誘発性熱産生（摂取kcalの約10%）
tef = avg(直近21日で食事記録のある日の摂取kcal) * TEF_RATE   // 記録なしは0

対象 = days のうち activities.length > 0 の日（直近21日まで）
各日の burn = BMR(その日時点の最新体重) * NEAT係数 + Σactivities.kcal
対象が5日以上 → round(burnの平均 + tef)（source: "measured"）
5日未満       → round(BMR * NEAT係数 + tef)（source: "estimate"、活動の実測分は省く）
```

### 4.3 目標プラン（targetPlan）
目標体重と目標期日から逆算。**基礎代謝を下限にクランプ**。
```
KCAL_PER_KG = 7200
kgToLose   = max(0, latestWeight - goalWeight)
reached    = latestWeight <= goalWeight
maxDeficit = max(0, maintenance - BMR)        // 安全な最大赤字
days       = 目標期日 - 今日（日数）
hasPlan    = targetDate && days > 0 && !reached && kgToLose > 0

dailyDeficit = hasPlan ? kgToLose * 7200 / days : 0
if (dailyDeficit > maxDeficit) { unrealistic = true; dailyDeficit = maxDeficit }
target = round(max(maintenance - dailyDeficit, BMR))   // ← 基礎代謝が下限
minDays = ceil(kgToLose * 7200 / maxDeficit)           // 現実的な最短日数

// PFC目標（target kcal から）
protein = round(latestWeight * 2.0)     // 体重×2g
fat     = round(target * 0.25 / 9)      // 総kcalの25%
carb    = max(0, round((target - protein*4 - fat*9) / 4))
```

### 4.4 今日の収支（ホーム）
```
burned  = BMR(最新体重) + Σ今日のactivities.kcal   // 筋トレは含めない
intake  = Σ今日のmeals(kcal*qty)
balance = burned - intake                          // >=0 で赤字（ダイエット進行）
```

### 4.5 目標進捗（ホーム「目標体重まで」）
```
start = weightLog最古の体重 / cur = 最新の体重 / goal = goalWeight
done  = start - cur（これまでの成果）
toGo  = max(0, cur - goal)（残り）
達成ペース dailyNeed = toGo * 7200 / (目標期日 - 今日)   // 「1日 -N kcal の赤字で達成」
kcal換算: done*7200（実績）, toGo*7200（残り）
```

---

## 5. 画面仕様（タブ構成）

ボトムナビ 4 タブ: **ホーム / 記録 / 筋トレ / 食品**（＋ヘッダー歯車で設定）。

### ホーム（俯瞰・閲覧専用、2カード）
1. **今日の収支**: 大きく収支数値（−なら緑＝赤字／＋なら赤）、摂取・消費の2本バー（同スケール比較）、区切り線の下に**直近7日の収支バーチャート**（赤字=緑/黒字=赤）。
2. **目標体重まで**: 「あと X kg ≈ Y kcal」、開始/現在/目標の3数値、**30日の体重折れ線（目標ライン付き、Y軸は整数）**、フッターに「これまでの成果 −Xkg・約Ykcal」「達成ペース 1日 −Nkcal の赤字」。

### 記録（入力・セグメント切替で1度に1つ）
上部にセグメント **[食事 / 体重 / 活動]**（各バッジ付き：食事=件数、体重=✓、活動=件数）。
- **食事**（デフォルト）: 「今日のサマリー」（摂取kcal＋残り/超過＋P/F/Cの目標対比バー。※消費・収支はここには出さない）＋ クイック記録。
  - クイック記録: 朝/昼/夜/間食の**スロット切替（現在時刻で自動選択・小計付き）**→ インライン検索（タップで即記録）→「よく食べる」チップ（履歴順、1タップ追加）→ 記録リストは**スロット別グループ＋小計**、各行に数量ステッパーと削除、追加時はUndoトースト。
- **体重**: 1入力（必須）。記録済みは✓表示。
- **活動**: 「消費 = 基礎代謝×NEAT ＋ 活動 ＋ 食事の熱産生(TEF)」の内訳表示（ホームと数字一致。式は §4.2 の維持カロリーの単日版＝`dayBurn`）＋ 活動追加（ウォーキングはMET概算電卓あり: `kcal ≒ MET × 体重 × 時間`）。

### 筋トレ
日付ナビ＋種目数/総挙上量サマリー＋種目リスト（重量×回数×セット）。**消費には加算しない**。

### 食品DB（UGC）
検索・タグフィルタ（ダイエット向け/コンビニ/外食/お菓子）・並び替え（名前/低kcal順/高タンパク順）・追加/編集/削除。サンプル13件をシード。

### 設定
プロフィール（性別/年齢/身長/目標体重/**目標期日**）。維持カロリー・1日の赤字・目標kcal・PFC を自動算出してプレビュー。無謀ペース時は警告＋現実的な最短日付を提示。デモ再投入/初期化ボタン。

---

## 6. 死守してほしい設計判断（理由つき）

移植時にうっかり戻さないこと。これらは議論の末に決めた仕様。

1. **維持カロリー(TDEE) = 基礎代謝×NEAT係数 + 実測活動 + TEF**（2026-06 方針転換）。当初は「実測主義」で活動レベル係数を廃止していたが、NEAT（無意識の日常活動）と TEF（食事誘発性熱産生）が抜け落ち維持カロリーを過小評価していたため、NEAT係数（日常活動量で可変・既定1.2）と TEF（摂取×0.10）を導入した。**日次の「今日の消費」表示（ホーム収支・記録画面の活動内訳）も同じ式の単日版（`dayBurn`）で揃える**：消費 = BMR×NEAT + 実測活動 + その日のTEF。維持カロリーと日次表示で式を一致させ、二重定義しない。
2. **目標は「目標体重 + 目標期日」から逆算**。固定の −500kcal はやめた。
3. **目標カロリーは基礎代謝を下限にクランプ**＋無謀ペース警告（健康面＋リバウンド離脱防止）。
4. **記録画面の食事サマリーには摂取・残り・PFCのみ**。消費・収支はホーム（俯瞰）に集約。役割分担：記録=入れる／ホーム=見る。
5. **食事は最優先・最速**：ワンタップ記録（チップ/検索）＋スロット自動選択＋Undo。入力の摩擦が離脱の主因なので守る。
6. **筋トレは消費に含めない**（ログ専用）。直接消費は小さく、推定が不正確なため。
7. **ウェルビーイング**：摂取が基礎代謝を大きく下回ると緑色の優しい注意。煽り・断罪表現はしない。中立トーン。

---

## 7. バックログ（優先度つき）

直近で議論していた順。

**A. お気に入り（次の一手）**
- 現状「よく食べる」チップは**履歴順の自動お気に入り**。これに **★手動ピン留め**（`Food.favorite`）を足し、チップ表示順を「★ピン留め → よく食べる → その他」にする。
- ※ユーザーと未確定の論点: 「既存チップに★で固定（A案）」か「独立したお気に入り画面（B案）」か。**A案推奨**。
- 発展: スロット別お気に入り（朝の定番を朝に優先）／**セット登録**（朝食まるごと1タップ）。

**B. CSVエクスポート**
- 日次データを構造化して出力。単体ではマス向け retention にはならないが、①データ所有権の信頼シグナル、②**AI分析への一番安い橋渡し**として価値。AIの前提として作る位置づけ。

**C. AI機能（本丸・差別化）**
- **最有力: 残り予算 → 食べるべきものを提案。**「残り620kcal・タンパク質あと35g → コンビニDBから具体名で提案」。食前に開く理由を作る（既存トラッカーがやらない領域）。あすけん等との差別化は"汎用助言"ではなく"自分のDB×赤字計算の具体性"。
- 補助: 自然言語/写真で記録（摩擦削減。ただしAIは下書き、ユーザー確定の建付け必須）／停滞期の診断・週次レビュー（辞めかけた瞬間に効く）。
- 実装順: CSV/構造化 → 週次レビュー → 残り予算提案。

**D. その他**
- 食事に実時刻の自動記録（入力不要、IF勢向け）。
- 活動＋筋トレを「運動」タブに統合するタクソノミー整理（任意）。
- 食品DBのCSV一括取り込み（DBを物量で強くする）。

---

## 8. 着手前に決めること

**保存先: ローカル完結 か クラウド同期か。**
- ローカルのみ → IndexedDB（Dexie）で完結。最速・最安。
- 複数端末同期/ログインを将来見据える → 最初から Supabase 等を入れた設計に。後付けは手戻りが大きい。

この1点を先に決めると Claude Code への指示がブレない。

---

## 9. Claude Code への最初のプロンプト（例）

> 添付の `diet-tracker.jsx`（動く仕様書）と `HANDOFF.md` を読んで、Next.js (App Router) + TypeScript + Tailwind + next-pwa に移植してほしい。
> - 状態管理は Zustand、永続化は IndexedDB（Dexie）。`window.storage` は使わない。
> - 計算ロジック（BMR・維持カロリー・目標プラン・収支）は `lib/calc.ts` に純関数で切り出し、ユニットテスト（Vitest）を書く。HANDOFF §4 の式を仕様とする。
> - データモデルは HANDOFF §3 の型をそのまま使う。
> - HANDOFF §6 の設計判断は変更しない。
> - 画面構成は HANDOFF §5 を踏襲。まずは現状機能の同等移植まで。お気に入り/CSV/AI（§7）は別タスク。
> - 保存先は【ローカルのみ / クラウド同期】で。← ここを§8の決定で埋める

---

## 10. 移植時のチェックリスト

- [ ] `window.storage` → IndexedDB に置換（get/set/list 相当）
- [ ] 単一ファイル → components / lib / store / types に分割
- [ ] `lib/calc.ts` の純関数化＋テスト（BMR・maintenance・targetPlan の境界値: 達成済み/期日切れ/無謀ペース/データ不足の初期推定）
- [ ] デモデータ生成（`demoDB`）を seed として移植（開発・スクショ用に有用）
- [ ] PWA 化（manifest, service worker, オフライン）
- [ ] 数値表示は等幅（tabular-nums）、Y軸は整数、モバイル幅 max-w-md を踏襲
