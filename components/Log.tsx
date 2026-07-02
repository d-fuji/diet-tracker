"use client";

// 記録（入力）: セグメント[食事/体重/活動]。食事はクイック記録、活動はMET電卓付き。
import { useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, Trash2, Undo2, Calculator } from "lucide-react";
import type { DB, Food, Meal, Slot, Activity, Mutate, TargetPlan } from "@/types";
import { bmrCalc, dayTef, getDay, latestWeight, sumMeals, sumActivities, targetPlan, withDay } from "@/lib/calc";
import { SLOTS, SLOT_LABELS, neatFactor } from "@/lib/constants";
import { uid, n, round, clamp, shortName, slotByTime, mealSlot, matchesSearch, fmtDate } from "@/lib/format";
import { Card, Num, SectionLabel, Field, Modal, MacroRow, ConfirmDialog, inputCls } from "@/components/ui";
import { FoodForm, type FoodDraft } from "@/components/Food";
import { DateNav } from "@/components/DateNav";

/** 食事サマリー（摂取・残り/超過・PFC目標対比のみ。消費・収支は出さない）。 */
function DailySummary({
  intake,
  plan,
  date,
  isToday,
}: {
  intake: { kcal: number; p: number; f: number; c: number };
  plan: TargetPlan | null;
  date: string;
  isToday: boolean;
}) {
  const goalKcal = plan?.target ?? 0;
  const remain = goalKcal - intake.kcal;
  const pct = goalKcal > 0 ? (intake.kcal / goalKcal) * 100 : 0;
  const over = remain < 0;
  return (
    <Card className="p-5">
      <SectionLabel
        right={
          plan ? (
            <span className="text-xs tabular-nums text-slate-400">目標 {goalKcal.toLocaleString()}kcal</span>
          ) : null
        }
      >
        {isToday ? "今日のサマリー" : `${fmtDate(date)}のサマリー`}
      </SectionLabel>
      <div className="mt-1 flex items-end justify-between">
        <div className="flex items-end gap-1.5">
          <Num className="text-4xl font-bold text-slate-900">{round(intake.kcal).toLocaleString()}</Num>
          <span className="text-sm text-slate-400 mb-1.5">kcal 摂取</span>
        </div>
        {plan && (
          <div className="text-right">
            <div className="text-[11px] text-slate-400">{over ? "超過" : "残り"}</div>
            <Num className={`text-xl font-bold ${over ? "text-rose-500" : "text-emerald-600"}`}>
              {over ? "+" : ""}
              {Math.abs(round(remain)).toLocaleString()}
            </Num>
          </div>
        )}
      </div>
      {plan && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${over ? "bg-rose-400" : "bg-emerald-500"}`}
            style={{ width: `${clamp(pct, 0, 100)}%` }}
          />
        </div>
      )}
      <div className="mt-4 space-y-2.5">
        {plan ? (
          <>
            <MacroRow label="タンパク質 P" val={intake.p} target={plan.p} fill="bg-emerald-500" />
            <MacroRow label="脂質 F" val={intake.f} target={plan.f} fill="bg-amber-400" />
            <MacroRow label="炭水化物 C" val={intake.c} target={plan.c} fill="bg-sky-400" />
          </>
        ) : (
          <p className="text-xs text-slate-400">設定でプロフィールを登録するとPFC目標が表示されます。</p>
        )}
      </div>
      {plan && !plan.hasPlan && !plan.reached && (
        <p className="mt-3 text-[11px] text-slate-400">
          目標期日が未設定のため、目標は維持カロリー基準です。設定で期日を入れると痩せるペースから自動計算されます。
        </p>
      )}
    </Card>
  );
}

/** 数量ステップ。1未満は 0.5（半分だけ食べた）を許可する。 */
const stepQty = (q: number, delta: 1 | -1): number => {
  if (delta > 0) return q === 0.5 ? 1 : q + 1;
  if (q > 1) return q - 1;
  return 0.5;
};

/** クイック記録（スロット切替・インライン検索・よく食べるチップ・追加/削除のUndo）。 */
function QuickMeal({ db, date, mutate }: { db: DB; date: string; mutate: Mutate }) {
  const day = getDay(db, date);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<Slot>(slotByTime());
  const [toast, setToast] = useState<{ message: string; undo: () => void } | null>(null);
  const [newFood, setNewFood] = useState<FoodDraft | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quickList = useMemo(() => {
    const order: string[] = [];
    const dates = Object.keys(db.days).sort((a, b) => b.localeCompare(a));
    for (const dt of dates)
      for (const m of [...db.days[dt].meals].reverse())
        if (m.foodId && !order.includes(m.foodId)) order.push(m.foodId);
    db.foods.forEach((f) => {
      if (!order.includes(f.id)) order.push(f.id);
    });
    return order
      .map((id) => db.foods.find((f) => f.id === id))
      .filter((f): f is Food => Boolean(f))
      .slice(0, 12);
  }, [db.days, db.foods]);

  const results = useMemo(
    () => (q ? db.foods.filter((f) => matchesSearch(f.name, q)).slice(0, 6) : []),
    [q, db.foods],
  );

  const showToast = (message: string, undo: () => void) => {
    setToast({ message, undo });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 4000);
  };

  const log = (food: Food) => {
    const id = uid();
    mutate((d) =>
      withDay(d, date, (dy) => ({
        ...dy,
        meals: [
          ...dy.meals,
          { id, foodId: food.id, name: food.name, qty: 1, kcal: food.kcal, p: food.p, f: food.f, c: food.c, slot },
        ],
      })),
    );
    showToast(`${SLOT_LABELS[slot]}に「${shortName(food.name)}」を追加`, () =>
      mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.filter((m) => m.id !== id) }))),
    );
  };
  const undo = () => {
    if (!toast) return;
    toast.undo();
    setToast(null);
  };
  const setQty = (id: string, delta: 1 | -1) =>
    mutate((d) =>
      withDay(d, date, (dy) => ({
        ...dy,
        meals: dy.meals.map((m) => (m.id === id ? { ...m, qty: stepQty(m.qty ?? 1, delta) } : m)),
      })),
    );
  // 削除は確認ダイアログではなく Undo で守る（記録のテンポを落とさない）。
  const del = (meal: Meal) => {
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.filter((m) => m.id !== meal.id) })));
    showToast(`「${shortName(meal.name)}」を削除しました`, () =>
      mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: [...dy.meals, meal] }))),
    );
  };
  const saveNewFood = (food: Food) => {
    mutate((d) => ({ ...d, foods: [...d.foods, food] }));
    log(food);
  };

  const meals = sumMeals(day);
  return (
    <Card className="p-4">
      <SectionLabel
        right={
          <span className="text-xs tabular-nums">
            <span className="font-semibold text-slate-900">{round(meals.kcal)}</span>
            <span className="text-slate-400"> kcal</span>
          </span>
        }
      >
        食事
      </SectionLabel>

      <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
        {SLOTS.map((s) => {
          const sub = day.meals
            .filter((m) => mealSlot(m) === s)
            .reduce((a, m) => a + m.kcal * (m.qty ?? 1), 0);
          return (
            <button
              key={s}
              onClick={() => setSlot(s)}
              className={`flex-1 rounded-lg py-1.5 text-center transition ${slot === s ? "bg-white shadow-sm" : ""}`}
            >
              <div className={`text-xs font-semibold ${slot === s ? "text-slate-900" : "text-slate-500"}`}>
                {SLOT_LABELS[s]}
              </div>
              {sub > 0 && <div className="text-[10px] tabular-nums text-slate-400">{round(sub)}</div>}
            </button>
          );
        })}
      </div>

      <div className="relative mt-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputCls} pl-9 mt-0`}
          placeholder={`「${SLOT_LABELS[slot]}」に追加 — 検索して即記録`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q && (
        <div className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                log(f);
                setQ("");
              }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-emerald-50 active:bg-emerald-100"
            >
              <div>
                <p className="text-sm text-slate-800">{f.name}</p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {f.kcal}kcal · P{f.p} F{f.f} C{f.c}
                </p>
              </div>
              <Plus size={16} className="text-emerald-600 shrink-0" />
            </button>
          ))}
          <button
            onClick={() => setNewFood({ name: q, kcal: "", p: "", f: "", c: "", tags: [] })}
            className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50"
          >
            <Plus size={15} />「{q}」を新規作成
          </button>
        </div>
      )}

      {!q && (
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {quickList.map((f) => (
            <button
              key={f.id}
              onClick={() => log(f)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-2 active:scale-95 active:border-emerald-400 transition"
            >
              <span className="text-[13px] text-slate-700">{shortName(f.name)}</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Plus size={13} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-3">
        {day.meals.length === 0 && (
          <p className="py-3 text-xs text-slate-400">上のスロットを選んで、食べたものを記録しましょう。</p>
        )}
        {SLOTS.map((s) => {
          const items = day.meals.filter((m) => mealSlot(m) === s);
          if (items.length === 0) return null;
          const sub = items.reduce((a, m) => a + m.kcal * (m.qty ?? 1), 0);
          return (
            <div key={s}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-xs font-semibold text-slate-600">{SLOT_LABELS[s]}</span>
                <Num className="text-[11px] text-slate-400">{round(sub)} kcal</Num>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((m) => {
                  const qy = m.qty ?? 1;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{m.name}</p>
                        <p className="text-[11px] tabular-nums text-slate-400">
                          <span className="font-medium text-slate-600">{round(m.kcal * qy)}kcal</span>
                          {"  "}P{+(m.p * qy).toFixed(1)} F{+(m.f * qy).toFixed(1)} C{+(m.c * qy).toFixed(1)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(m.id, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200"
                          aria-label="数量を減らす"
                        >
                          <Minus size={14} />
                        </button>
                        <Num className="w-7 text-center text-sm font-semibold text-slate-700">{qy}</Num>
                        <button
                          onClick={() => setQty(m.id, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200"
                          aria-label="数量を増やす"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => del(m)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:text-rose-500 active:bg-slate-100"
                          aria-label="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-3 px-4">
          <div
            role="status"
            aria-live="polite"
            className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span className="truncate">{toast.message}</span>
            <button onClick={undo} className="flex shrink-0 items-center gap-1 font-semibold text-emerald-300">
              <Undo2 size={15} />
              取り消す
            </button>
          </div>
        </div>
      )}
      {newFood && <FoodForm initial={newFood} onSave={saveNewFood} onClose={() => setNewFood(null)} />}
    </Card>
  );
}

/** ウォーキングのMET概算電卓: kcal ≒ MET × 体重 × 時間。 */
function WalkCalc({ weight, onApply }: { weight: number | null; onApply: (kcal: number) => void }) {
  const [min, setMin] = useState("");
  const [met, setMet] = useState("3.5");
  const kcal = round(n(met) * n(weight ?? 0) * (n(min) / 60));
  return (
    <div className="rounded-xl bg-slate-50 p-3 mb-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
        <Calculator size={14} /> ウォーキング概算
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="時間(分)">
          <input
            className={inputCls}
            type="number"
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </Field>
        <Field label="強度MET" hint="散歩3.0/早歩き4.3">
          <input
            className={inputCls}
            type="number"
            step="0.1"
            value={met}
            onChange={(e) => setMet(e.target.value)}
          />
        </Field>
        <div className="flex flex-col justify-end">
          <span className="text-xs text-slate-400">
            ≒ <Num className="font-semibold text-slate-700">{kcal}</Num> kcal
          </span>
          <button
            disabled={!kcal}
            onClick={() => onApply(kcal)}
            className="mt-1 rounded-lg bg-slate-900 disabled:opacity-30 px-2 py-1.5 text-xs font-semibold text-white"
          >
            反映
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityForm({
  weight,
  onAdd,
  onClose,
}: {
  weight: number | null;
  onAdd: (a: Activity) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [kcal, setKcal] = useState("");
  return (
    <Modal title="活動・消費を記録" onClose={onClose}>
      <WalkCalc
        weight={weight}
        onApply={(k) => {
          setKcal(String(k));
          if (!label) setLabel("ウォーキング");
        }}
      />
      <Field label="活動名">
        <input
          className={inputCls}
          placeholder="ウォーキング / 通勤 / アクティブエネルギー など"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <div className="mt-2">
        <Field label="消費kcal">
          <input
            className={inputCls}
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </Field>
      </div>
      <button
        disabled={!label || kcal === ""}
        onClick={() => {
          onAdd({ id: uid(), label, kcal: n(kcal) });
          onClose();
        }}
        className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white"
      >
        追加
      </button>
    </Modal>
  );
}

/** 体重入力。date を key にして日付切替時に内部 state を初期化する（effect 不要）。 */
function WeightCard({
  lw,
  wToday,
  onSave,
}: {
  lw: number | null;
  wToday: number | "";
  onSave: (weight: number) => void;
}) {
  const [wInput, setWInput] = useState(wToday === "" ? "" : String(wToday));
  const weightDone = wToday !== "";
  return (
    <Card className="p-4">
      <SectionLabel
        right={lw != null ? <span className="text-xs tabular-nums text-slate-400">前回 {lw}kg</span> : null}
      >
        体重（必須）
      </SectionLabel>
      <div className="mt-2 flex gap-2">
        <input
          className={`${inputCls} mt-0`}
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="kg"
          value={wInput}
          onChange={(e) => setWInput(e.target.value)}
        />
        <button
          onClick={() => {
            if (wInput !== "") onSave(n(wInput));
          }}
          disabled={wInput === ""}
          className="shrink-0 rounded-xl bg-slate-900 disabled:opacity-30 px-4 text-sm font-semibold text-white"
        >
          保存
        </button>
      </div>
      {weightDone && <p className="mt-2 text-[11px] text-emerald-600">この日の体重は記録済みです。</p>}
    </Card>
  );
}

type Section = "食事" | "体重" | "活動";

export function LogScreen({
  db,
  date,
  setDate,
  today,
  mutate,
}: {
  db: DB;
  date: string;
  setDate: (d: string) => void;
  today: string;
  mutate: Mutate;
}) {
  const day = getDay(db, date);
  const [actOpen, setActOpen] = useState(false);
  const [section, setSection] = useState<Section>("食事");
  const [delAct, setDelAct] = useState<Activity | null>(null);
  const lw = latestWeight(db, date);
  const wToday = db.weightLog.find((w) => w.date === date)?.weight ?? "";

  const plan = targetPlan(db);
  const meals = sumMeals(day);
  const weightDone = wToday !== "";
  const actCount = day.activities.length;
  const bmrDate = db.profile && lw ? bmrCalc(db.profile.sex, db.profile.age, db.profile.heightCm, lw) : 0;
  const actKcal = sumActivities(day);
  const restKcal = bmrDate * neatFactor(db.profile?.activityLevel); // 基礎代謝×NEAT（寝てても消費＋日常活動）
  const tefKcal = dayTef(day); // 食事誘発性熱産生
  const burnTotal = restKcal + actKcal + tefKcal;

  const saveWeight = (weight: number) =>
    mutate((d) => ({
      ...d,
      weightLog: [...d.weightLog.filter((w) => w.date !== date), { date, weight }],
    }));
  const addAct = (a: Activity) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, activities: [...dy.activities, a] })));
  const removeAct = (id: string) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, activities: dy.activities.filter((m) => m.id !== id) })));

  const TABS_L: { id: Section; badge: string | number | null }[] = [
    { id: "食事", badge: day.meals.length || null },
    { id: "体重", badge: weightDone ? "✓" : null },
    { id: "活動", badge: actCount || null },
  ];

  return (
    <div className="pb-4">
      <DateNav date={date} setDate={setDate} today={today} />
      <div className="space-y-4 px-4">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS_L.map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
                section === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t.id}
              {t.badge != null && (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    section === t.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {section === "食事" && (
          <>
            <DailySummary intake={meals} plan={plan} date={date} isToday={date === today} />
            <QuickMeal db={db} date={date} mutate={mutate} />
          </>
        )}

        {section === "体重" && (
          <WeightCard key={date} lw={lw} wToday={wToday} onSave={saveWeight} />
        )}

        {section === "活動" && (
          <Card className="p-4">
            <SectionLabel
              right={
                <button
                  onClick={() => setActOpen(true)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus size={14} />
                  追加
                </button>
              }
            >
              活動
            </SectionLabel>
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">消費カロリー</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {round(burnTotal).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-slate-400">
                基礎代謝×NEAT {round(restKcal).toLocaleString()} ＋ 活動{" "}
                <span className="font-semibold text-emerald-600">{round(actKcal)}</span> ＋ 食事の熱産生{" "}
                {round(tefKcal).toLocaleString()}
              </div>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {day.activities.length === 0 && (
                <p className="py-3 text-xs text-slate-400">基礎代謝に加算される運動・歩行を記録。</p>
              )}
              {day.activities.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5">
                  <p className="text-sm text-slate-800">{a.label}</p>
                  <div className="flex items-center gap-1">
                    <Num className="text-sm font-semibold text-slate-700">+{a.kcal}</Num>
                    <button
                      onClick={() => setDelAct(a)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:text-rose-500 active:bg-slate-100"
                      aria-label="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      {actOpen && <ActivityForm weight={lw} onAdd={addAct} onClose={() => setActOpen(false)} />}
      {delAct && (
        <ConfirmDialog
          title="活動を削除"
          message={`「${delAct.label}」(+${delAct.kcal}kcal) を削除します。よろしいですか？`}
          onConfirm={() => removeAct(delAct.id)}
          onClose={() => setDelAct(null)}
        />
      )}
    </div>
  );
}
