"use client";

// 記録（入力）: セグメント[食事/体重/活動]。食事はクイック記録、活動はMET電卓付き。
import { useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, Trash2, Undo2, Calculator } from "lucide-react";
import type { DB, Food, Slot, Activity, Mutate, TargetPlan } from "@/types";
import { bmrCalc, dayTef, getDay, latestWeight, sumMeals, sumActivities, targetPlan, withDay } from "@/lib/calc";
import { SLOTS, uid, n, round, clamp, shortName, slotByTime, mealSlot, neatFactor } from "@/lib/format";
import {
  Card,
  Num,
  SectionLabel,
  Field,
  Modal,
  MacroRow,
  Button,
  Input,
  Separator,
  SegTabs,
} from "@/components/ui";
import { Meter } from "@heroui/react";
import { FoodForm, type FoodDraft } from "@/components/Food";
import { DateNav } from "@/components/DateNav";

/** タブラベルに付ける小さなカウントバッジ。 */
function TabBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-100 px-1 text-[10px] font-bold text-emerald-700">
      {children}
    </span>
  );
}

/** 食事サマリー（摂取・残り/超過・PFC目標対比のみ。消費・収支は出さない）。 */
function DailySummary({
  intake,
  plan,
}: {
  intake: { kcal: number; p: number; f: number; c: number };
  plan: TargetPlan | null;
}) {
  const goalKcal = plan?.target ?? 0;
  const remain = goalKcal - intake.kcal;
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
        今日のサマリー
      </SectionLabel>
      <div className="mt-1 flex items-end justify-between">
        <div className="flex items-end gap-1.5">
          <Num className="text-4xl font-bold text-slate-900">{round(intake.kcal).toLocaleString()}</Num>
          <span className="mb-1.5 text-sm text-slate-400">kcal 摂取</span>
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
        <Meter
          value={clamp(intake.kcal, 0, goalKcal || 1)}
          maxValue={goalKcal || 1}
          className="mt-3 block"
        >
          <Meter.Track className="h-2 overflow-hidden rounded-full bg-slate-100">
            <Meter.Fill className={`h-full rounded-full ${over ? "bg-rose-400" : "bg-emerald-500"}`} />
          </Meter.Track>
        </Meter>
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

/** クイック記録（スロット切替・インライン検索・よく食べるチップ・Undo）。 */
function QuickMeal({ db, date, mutate }: { db: DB; date: string; mutate: Mutate }) {
  const day = getDay(db, date);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<Slot>(slotByTime());
  const [toast, setToast] = useState<{ name: string; mealId: string; slot: Slot } | null>(null);
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
    () => (q ? db.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []),
    [q, db.foods],
  );

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
    setToast({ name: food.name, mealId: id, slot });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 3000);
  };
  const undo = () => {
    if (!toast) return;
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.filter((m) => m.id !== toast.mealId) })));
    setToast(null);
  };
  const setQty = (id: string, delta: number) =>
    mutate((d) =>
      withDay(d, date, (dy) => ({
        ...dy,
        meals: dy.meals.map((m) => (m.id === id ? { ...m, qty: Math.max(1, (m.qty ?? 1) + delta) } : m)),
      })),
    );
  const del = (id: string) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.filter((m) => m.id !== id) })));
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

      <div className="mt-3">
        <SegTabs
          aria-label="食事スロット"
          value={slot}
          onChange={(s) => setSlot(s)}
          items={SLOTS.map((s) => {
            const sub = day.meals.filter((m) => mealSlot(m) === s).reduce((a, m) => a + m.kcal * (m.qty ?? 1), 0);
            return {
              id: s,
              label: (
                <span className="flex items-center gap-1">
                  {s}
                  {sub > 0 && <span className="text-[10px] tabular-nums text-slate-400">{round(sub)}</span>}
                </span>
              ),
            };
          })}
        />
      </div>

      <div className="relative mt-3">
        <Search size={16} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder={`「${slot}」に追加 — 検索して即記録`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q && (
        <Card className="mt-1.5 overflow-hidden">
          {results.map((f, i) => (
            <div key={f.id}>
              {i > 0 && <Separator />}
              <Button
                variant="ghost"
                fullWidth
                className="h-auto justify-between rounded-none px-3 py-2.5"
                onPress={() => {
                  log(f);
                  setQ("");
                }}
              >
                <div className="text-left">
                  <p className="text-sm text-slate-800">{f.name}</p>
                  <p className="text-[11px] tabular-nums text-slate-400">
                    {f.kcal}kcal · P{f.p} F{f.f} C{f.c}
                  </p>
                </div>
                <Plus size={16} className="shrink-0 text-emerald-600" />
              </Button>
            </div>
          ))}
          {results.length > 0 && <Separator />}
          <Button
            variant="ghost"
            fullWidth
            className="justify-start gap-1.5 rounded-none px-3 py-2.5 text-emerald-700"
            onPress={() => setNewFood({ name: q, kcal: "", p: "", f: "", c: "", tags: [] })}
          >
            <Plus size={15} />「{q}」を新規作成
          </Button>
        </Card>
      )}

      {!q && (
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {quickList.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant="outline"
              className="shrink-0 rounded-full"
              onPress={() => log(f)}
            >
              {shortName(f.name)}
              <Plus size={13} className="text-emerald-600" />
            </Button>
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
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-slate-600">{s}</span>
                <Num className="text-[11px] text-slate-400">{round(sub)} kcal</Num>
              </div>
              <Separator />
              <div>
                {items.map((m, idx) => {
                  const qy = m.qty ?? 1;
                  return (
                    <div key={m.id}>
                      {idx > 0 && <Separator />}
                      <div className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-800">{m.name}</p>
                          <p className="text-[11px] tabular-nums text-slate-400">
                            <span className="font-medium text-slate-600">{round(m.kcal * qy)}kcal</span>
                            {"  "}P{+(m.p * qy).toFixed(1)} F{+(m.f * qy).toFixed(1)} C{+(m.c * qy).toFixed(1)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            isIconOnly
                            variant="secondary"
                            size="sm"
                            aria-label="数量を減らす"
                            onPress={() => setQty(m.id, -1)}
                          >
                            <Minus size={13} />
                          </Button>
                          <Num className="w-5 text-center text-sm font-semibold text-slate-700">{qy}</Num>
                          <Button
                            isIconOnly
                            variant="secondary"
                            size="sm"
                            aria-label="数量を増やす"
                            onPress={() => setQty(m.id, 1)}
                          >
                            <Plus size={13} />
                          </Button>
                          <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label="削除"
                            onPress={() => del(m.id)}
                          >
                            <Trash2 size={16} className="text-slate-400" />
                          </Button>
                        </div>
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
          <div className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
            <span className="truncate">
              {toast.slot}に「{shortName(toast.name)}」を追加
            </span>
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
    <div className="mb-3 rounded-xl bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Calculator size={14} /> ウォーキング概算
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="時間(分)">
          <Input type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
        <Field label="強度MET" hint="散歩3.0/早歩き4.3">
          <Input type="number" step="0.1" value={met} onChange={(e) => setMet(e.target.value)} />
        </Field>
        <div className="flex flex-col justify-end">
          <span className="text-xs text-slate-400">
            ≒ <Num className="font-semibold text-slate-700">{kcal}</Num> kcal
          </span>
          <Button variant="secondary" size="sm" isDisabled={!kcal} className="mt-1" onPress={() => onApply(kcal)}>
            反映
          </Button>
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
      <div className="flex flex-col gap-3">
        <Field label="活動名">
          <Input
            placeholder="ウォーキング / 通勤 / アクティブエネルギー など"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="消費kcal">
          <Input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </Field>
        <Button
          variant="primary"
          fullWidth
          isDisabled={!label || kcal === ""}
          className="mt-1"
          onPress={() => {
            onAdd({ id: uid(), label, kcal: n(kcal) });
            onClose();
          }}
        >
          追加
        </Button>
      </div>
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
        <Input
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="kg"
          value={wInput}
          onChange={(e) => setWInput(e.target.value)}
        />
        <Button
          variant="primary"
          isDisabled={wInput === ""}
          className="shrink-0"
          onPress={() => {
            if (wInput !== "") onSave(n(wInput));
          }}
        >
          保存
        </Button>
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
  mutate,
}: {
  db: DB;
  date: string;
  setDate: (d: string) => void;
  mutate: Mutate;
}) {
  const day = getDay(db, date);
  const [actOpen, setActOpen] = useState(false);
  const [section, setSection] = useState<Section>("食事");
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
  const delAct = (id: string) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, activities: dy.activities.filter((m) => m.id !== id) })));

  const sections: { id: Section; badge: string | number | null }[] = [
    { id: "食事", badge: day.meals.length || null },
    { id: "体重", badge: weightDone ? "✓" : null },
    { id: "活動", badge: actCount || null },
  ];

  return (
    <div className="pb-4">
      <DateNav date={date} setDate={setDate} />
      <div className="space-y-4 px-4">
        <SegTabs
          aria-label="記録の種類"
          value={section}
          onChange={(s) => setSection(s)}
          items={sections.map((t) => ({
            id: t.id,
            label: (
              <span className="flex items-center">
                {t.id}
                {t.badge != null && <TabBadge>{t.badge}</TabBadge>}
              </span>
            ),
          }))}
        />

        {section === "食事" && (
          <>
            <DailySummary intake={meals} plan={plan} />
            <QuickMeal db={db} date={date} mutate={mutate} />
          </>
        )}

        {section === "体重" && <WeightCard key={date} lw={lw} wToday={wToday} onSave={saveWeight} />}

        {section === "活動" && (
          <Card className="p-4">
            <SectionLabel
              right={
                <Button variant="primary" size="sm" onPress={() => setActOpen(true)}>
                  <Plus size={14} />
                  追加
                </Button>
              }
            >
              活動
            </SectionLabel>
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">消費カロリー</span>
                <span className="text-sm font-bold tabular-nums text-slate-900">
                  {round(burnTotal).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-slate-400">
                基礎代謝×NEAT {round(restKcal).toLocaleString()} ＋ 活動{" "}
                <span className="font-semibold text-emerald-600">{round(actKcal)}</span> ＋ 食事の熱産生{" "}
                {round(tefKcal).toLocaleString()}
              </div>
            </div>
            <div className="mt-2">
              {day.activities.length === 0 && (
                <p className="py-3 text-xs text-slate-400">基礎代謝に加算される運動・歩行を記録。</p>
              )}
              {day.activities.map((a, i) => (
                <div key={a.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-2">
                    <p className="text-sm text-slate-800">{a.label}</p>
                    <div className="flex items-center gap-1">
                      <Num className="text-sm font-semibold text-slate-700">+{a.kcal}</Num>
                      <Button isIconOnly variant="ghost" size="sm" aria-label="削除" onPress={() => delAct(a.id)}>
                        <Trash2 size={16} className="text-slate-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      {actOpen && <ActivityForm weight={lw} onAdd={addAct} onClose={() => setActOpen(false)} />}
    </div>
  );
}
