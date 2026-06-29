import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  ReferenceLine, Tooltip, Cell,
} from "recharts";
import {
  Home, NotebookPen, Dumbbell, Database, Settings, Plus, X, Trash2,
  ChevronLeft, ChevronRight, Calculator, Search, Pencil, Minus, Undo2, Target,
} from "lucide-react";

/* ----------------------------- storage layer ----------------------------- */
const KEY = "diet-tracker-v2";
let memFallback = null;
const store = {
  async load() {
    try {
      if (typeof window !== "undefined" && window.storage) {
        const r = await window.storage.get(KEY);
        return r ? JSON.parse(r.value) : null;
      }
    } catch (e) { /* missing key */ }
    return memFallback;
  },
  async save(db) {
    memFallback = db;
    try {
      if (typeof window !== "undefined" && window.storage) await window.storage.set(KEY, JSON.stringify(db));
    } catch (e) { console.error("save failed", e); }
  },
};

/* ------------------------------- helpers --------------------------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shiftDate = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const fmtDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const w = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${m}/${d}(${w})`;
};
const n = (v) => (Number.isFinite(+v) ? +v : 0);
const round = (v) => Math.round(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const shortName = (s) => s.replace(/\s?\d+(個|本|杯|枚|g)$/, "");
const bmrCalc = (sex, age, h, w) => {
  if (!h || !w || !age) return 0;
  const base = 10 * w + 6.25 * h - 5 * age;
  return round(sex === "female" ? base - 161 : base + 5);
};

const KCAL_PER_KG = 7200; // approx kcal stored per kg of body fat
const COLDSTART_FACTOR = 1.5; // backstage estimate for maintenance until enough measured days
const daysBetween = (a, b) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};

const TAGS = [
  { id: "diet", label: "ダイエット向け", cls: "bg-emerald-100 text-emerald-700" },
  { id: "conveni", label: "コンビニ", cls: "bg-sky-100 text-sky-700" },
  { id: "eatout", label: "外食", cls: "bg-amber-100 text-amber-700" },
  { id: "sweets", label: "お菓子", cls: "bg-rose-100 text-rose-700" },
];

/* food.kcal/p/f/c are per ONE serving; meals carry qty separately. */
const seedFoods = [
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

const defaultDB = () => ({ profile: null, weightLog: [], foods: seedFoods, days: {} });
const emptyDay = () => ({ meals: [], activities: [], workouts: [] });
const getDay = (db, date) => db.days[date] || emptyDay();
const latestWeight = (db, before) => {
  const log = [...db.weightLog].filter((w) => !before || w.date <= before).sort((a, b) => b.date.localeCompare(a.date));
  return log[0]?.weight ?? null;
};
const sumMeals = (day) => day.meals.reduce((a, m) => {
  const q = m.qty ?? 1;
  return { kcal: a.kcal + n(m.kcal) * q, p: a.p + n(m.p) * q, f: a.f + n(m.f) * q, c: a.c + n(m.c) * q };
}, { kcal: 0, p: 0, f: 0, c: 0 });
const sumActivities = (day) => day.activities.reduce((a, x) => a + n(x.kcal), 0);

const SLOTS = ["朝", "昼", "夜", "間食"];
const slotByTime = () => {
  const h = new Date().getHours();
  if (h < 11) return "朝";
  if (h < 16) return "昼";
  if (h < 21) return "夜";
  return "間食";
};
const mealSlot = (m) => (SLOTS.includes(m.slot) ? m.slot : "間食");

/* Maintenance = average measured daily burn (BMR + logged activity) over recorded days.
   Falls back to a coarse estimate until enough days with activity records exist. */
function maintenanceKcal(db) {
  const lw = latestWeight(db);
  const p = db.profile;
  if (!p || !lw) return null;
  const bmr = bmrCalc(p.sex, p.age, p.heightCm, lw);
  const dates = Object.keys(db.days).filter((dt) => getDay(db, dt).activities.length > 0).sort();
  const recent = dates.slice(-21);
  if (recent.length >= 5) {
    const burns = recent.map((dt) => {
      const w = latestWeight(db, dt) ?? lw;
      return bmrCalc(p.sex, p.age, p.heightCm, w) + sumActivities(getDay(db, dt));
    });
    const avg = burns.reduce((a, b) => a + b, 0) / burns.length;
    return { kcal: Math.round(avg), source: "measured", days: recent.length, bmr };
  }
  return { kcal: Math.round(bmr * COLDSTART_FACTOR), source: "estimate", days: recent.length, bmr };
}

/* Daily plan: target kcal derived from goal weight + target date.
   deficit/day = (kg to lose × 7200) / days left, capped so target never drops below BMR. */
function targetPlan(db) {
  const p = db.profile;
  const lw = latestWeight(db);
  if (!p || !lw) return null;
  const m = maintenanceKcal(db);
  const bmr = m.bmr;
  const kgToLose = Math.max(0, +(lw - p.goalWeight).toFixed(2));
  const reached = lw <= p.goalWeight;
  const maxDeficit = Math.max(0, m.kcal - bmr);
  const days = p.targetDate ? daysBetween(todayStr(), p.targetDate) : null;
  const hasPlan = !!p.targetDate && days != null && days > 0 && !reached && kgToLose > 0;

  let dailyDeficit = 0, unrealistic = false;
  if (hasPlan) {
    dailyDeficit = (kgToLose * KCAL_PER_KG) / days;
    if (dailyDeficit > maxDeficit) { unrealistic = true; dailyDeficit = maxDeficit; }
  }
  const target = Math.round(Math.max(m.kcal - dailyDeficit, bmr));
  const minDays = kgToLose > 0 && maxDeficit > 0 ? Math.ceil((kgToLose * KCAL_PER_KG) / maxDeficit) : null;
  const pro = Math.round(lw * 2.0);
  const fat = Math.round((target * 0.25) / 9);
  const carb = Math.max(0, Math.round((target - pro * 4 - fat * 9) / 4));
  return {
    maintenance: m.kcal, source: m.source, bmr, target,
    dailyDeficit: Math.round(dailyDeficit), p: pro, f: fat, c: carb,
    days, kgToLose, reached, hasPlan, unrealistic, minDays,
  };
}

/* ------------------------------ demo seed -------------------------------- */
function demoDB() {
  const foods = seedFoods.map((f) => ({ ...f }));
  const F = (nm) => foods.find((f) => f.name.startsWith(nm));
  const meal = (f, qty = 1, slot = "間食") => ({ id: uid(), foodId: f.id, name: f.name, qty, kcal: f.kcal, p: f.p, f: f.f, c: f.c, slot });

  const weightLog = [];
  for (let i = 29; i >= 0; i--) {
    const dt = shiftDate(todayStr(), -i);
    const trend = 77.6 - (29 - i) * 0.155;
    const wobble = Math.sin((29 - i) * 1.6) * 0.28;
    weightLog.push({ date: dt, weight: +(trend + wobble).toFixed(1) });
  }

  const prot = F("プロテイン"), oat = F("オートミール"), yog = F("ギリシャ");
  const onigiri = F("おにぎり"), chick = F("サラダチキン"), mune = F("鶏むね");
  const fish = F("焼き魚"), gyudon = F("牛丼"), almond = F("素焼き"), choco = F("高カカオ");

  const days = {};
  for (let i = 6; i >= 0; i--) {
    const dt = shiftDate(todayStr(), -i);
    const cheat = i === 2;
    const meals = [meal(prot, 1, "朝"), meal(i % 2 ? oat : yog, 1, "朝")];
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
          { id: uid(), ex: i === 3 ? "スクワット" : "ラットプルダウン", weight: i === 3 ? 80 : 55, reps: 8, sets: 3 },
        ]
      : [];
    days[dt] = { meals, activities, workouts };
  }
  return { profile: { sex: "male", age: 32, heightCm: 174, goalWeight: 68, targetDate: shiftDate(todayStr(), 150) }, weightLog, foods, days };
}

const withDay = (d, date, fn) => ({ ...d, days: { ...d.days, [date]: fn(getDay(d, date)) } });

/* ------------------------------ primitives ------------------------------- */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white border border-slate-200/80 shadow-sm ${className}`}>{children}</div>
);
const Num = ({ children, className = "" }) => <span className={`tabular-nums ${className}`}>{children}</span>;
const SectionLabel = ({ children, right }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</span>
    {right}
  </div>
);
const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="text-xs font-medium text-slate-500">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);
const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 text-[15px] tabular-nums outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100";

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* macro vs target row with bar */
function MacroRow({ label, val, target, fill }) {
  const pct = target > 0 ? (val / target) * 100 : 0;
  const over = val > target && target > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-xs tabular-nums">
          <span className={`font-semibold ${over ? "text-rose-500" : "text-slate-900"}`}>{round(val)}</span>
          <span className="text-slate-400"> / {target}g</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${over ? "bg-rose-400" : fill}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------- Home ----------------------------------- */
function Ledger({ burned, intake, weekData }) {
  const balance = burned - intake;
  const deficit = balance >= 0;
  const max = Math.max(intake, burned, 1);
  const bars = [
    { label: "摂取", val: intake, cls: intake > burned ? "bg-rose-400" : "bg-slate-400" },
    { label: "消費", val: burned, cls: "bg-emerald-500" },
  ];
  return (
    <Card className="p-5">
      <SectionLabel>今日の収支</SectionLabel>
      <div className="mt-1 flex items-end gap-1.5">
        <Num className={`text-4xl font-bold ${deficit ? "text-emerald-600" : "text-rose-500"}`}>{deficit ? "−" : "+"}{Math.abs(round(balance)).toLocaleString()}</Num>
        <span className="text-sm text-slate-400 mb-1.5">kcal</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2.5">
            <span className="w-7 shrink-0 text-[11px] font-medium text-slate-500">{b.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${b.cls}`} style={{ width: `${(b.val / max) * 100}%` }} />
            </div>
            <Num className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700">{round(b.val).toLocaleString()}</Num>
          </div>
        ))}
      </div>
      {weekData && weekData.length > 1 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">直近7日の推移</span>
            <span className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />赤字</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />黒字</span>
            </span>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40} />
                <ReferenceLine y={0} stroke="#cbd5e1" />
                <Bar dataKey="bal" radius={[4, 4, 4, 4]}>
                  {weekData.map((d, i) => <Cell key={i} fill={d.bal >= 0 ? "#10b981" : "#f43f5e"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

function GoalProgress({ db }) {
  const sorted = [...db.weightLog].sort((a, b) => a.date.localeCompare(b.date));
  if (!db.profile || sorted.length === 0) return null;
  const start = sorted[0].weight, startDate = sorted[0].date;
  const cur = sorted[sorted.length - 1].weight;
  const goal = db.profile.goalWeight;
  const need = start - goal;
  const done = start - cur;
  const toGo = cur - goal;
  const reached = cur <= goal;
  const toGoKg = Math.max(0, toGo);
  const doneKcal = Math.round(Math.max(0, done) * KCAL_PER_KG);
  const remainKcal = Math.round(toGoKg * KCAL_PER_KG);

  const td = db.profile.targetDate;
  let dailyNeed = null;
  if (td && !reached && toGoKg > 0) {
    const daysLeft = daysBetween(todayStr(), td);
    if (daysLeft > 0) dailyNeed = Math.round((toGoKg * KCAL_PER_KG) / daysLeft);
  }

  const data = sorted.slice(-30).map((w) => ({ date: w.date.slice(5), weight: w.weight }));
  const ws = data.map((d) => d.weight);
  const yMin = data.length ? Math.floor(Math.min(...ws)) - 1 : 0;
  const yMax = data.length ? Math.ceil(Math.max(...ws)) + 1 : 1;

  return (
    <Card className="p-5">
      <SectionLabel right={td ? <span className="text-xs tabular-nums text-slate-400">期日 {fmtDate(td).slice(0, -3)}</span> : null}>目標体重まで</SectionLabel>
      <div className="mt-1 flex items-end gap-1.5">
        {reached
          ? <Num className="text-3xl font-bold text-emerald-600">達成 🎉</Num>
          : <>
              <span className="text-sm text-slate-400 mb-1.5">あと</span>
              <Num className="text-4xl font-bold text-slate-900">{toGoKg.toFixed(1)}</Num>
              <span className="text-sm text-slate-400 mb-1.5">kg</span>
              <span className="ml-1 mb-1.5 text-xs tabular-nums text-slate-400">≈ {remainKcal.toLocaleString()} kcal</span>
            </>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 py-2"><div className="text-[11px] text-slate-400">開始</div><div><Num className="text-base font-semibold text-slate-700">{start}</Num><span className="text-[11px] text-slate-400"> kg</span></div></div>
        <div className="rounded-xl bg-emerald-50 py-2"><div className="text-[11px] text-emerald-600/90">現在</div><div><Num className="text-base font-bold text-emerald-700">{cur}</Num><span className="text-[11px] text-emerald-600/90"> kg</span></div></div>
        <div className="rounded-xl bg-slate-50 py-2"><div className="text-[11px] text-slate-400">目標</div><div><Num className="text-base font-semibold text-slate-700">{goal}</Num><span className="text-[11px] text-slate-400"> kg</span></div></div>
      </div>
      {data.length > 1 && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis domain={[yMin, yMax]} allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="weight" stroke="#0f172a" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">これまでの成果</span>
          <span className="tabular-nums"><span className="font-semibold text-emerald-600">−{Math.max(0, done).toFixed(1)}kg</span><span className="text-slate-400"> ・ 約{doneKcal.toLocaleString()}kcal</span></span>
        </div>
        {dailyNeed != null && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">達成ペース</span>
            <span className="tabular-nums"><span className="font-bold text-emerald-600">1日 −{dailyNeed.toLocaleString()}kcal</span><span className="text-slate-400"> の赤字</span></span>
          </div>
        )}
      </div>
    </Card>
  );
}

function HomeScreen({ db, openSettings }) {
  const date = todayStr();
  const day = getDay(db, date);
  const lw = latestWeight(db);
  const bmr = db.profile && lw ? bmrCalc(db.profile.sex, db.profile.age, db.profile.heightCm, lw) : 0;
  const meals = sumMeals(day);
  const burned = bmr + sumActivities(day);

  const balanceData = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDate(date, -i);
      const dy = getDay(db, d);
      const w = latestWeight(db, d) ?? lw;
      const b = (db.profile && w ? bmrCalc(db.profile.sex, db.profile.age, db.profile.heightCm, w) : 0) + sumActivities(dy);
      out.push({ date: fmtDate(d).slice(0, -3), bal: round(b - sumMeals(dy).kcal) });
    }
    return out;
  }, [db, date, lw]);

  if (!db.profile) {
    return (
      <div className="px-4 pt-8">
        <Card className="p-6 text-center">
          <p className="text-slate-600 text-sm leading-relaxed">最初にプロフィール（性別・年齢・身長・目標体重）を登録すると、基礎代謝・収支・PFC目標が計算されます。</p>
          <button onClick={openSettings} className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">プロフィールを登録</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-2 pb-4">
      <Ledger burned={burned} intake={meals.kcal} weekData={balanceData} />
      <GoalProgress db={db} />
    </div>
  );
}

/* ---------------------------- Date navigator ----------------------------- */
function DateNav({ date, setDate }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <button onClick={() => setDate(shiftDate(date, -1))} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"><ChevronLeft size={20} /></button>
      <button onClick={() => setDate(todayStr())} className="min-w-[110px] text-center text-sm font-semibold text-slate-900">{date === todayStr() ? "今日 " : ""}{fmtDate(date)}</button>
      <button onClick={() => setDate(shiftDate(date, 1))} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"><ChevronRight size={20} /></button>
    </div>
  );
}

/* ----------------------- Daily summary (input top) ----------------------- */
function DailySummary({ intake, plan }) {
  const goalKcal = plan?.target ?? 0;
  const remain = goalKcal - intake.kcal;
  const pct = goalKcal > 0 ? (intake.kcal / goalKcal) * 100 : 0;
  const over = remain < 0;
  return (
    <Card className="p-5">
      <SectionLabel right={plan ? <span className="text-xs tabular-nums text-slate-400">目標 {goalKcal.toLocaleString()}kcal</span> : null}>今日のサマリー</SectionLabel>
      <div className="mt-1 flex items-end justify-between">
        <div className="flex items-end gap-1.5">
          <Num className="text-4xl font-bold text-slate-900">{round(intake.kcal).toLocaleString()}</Num>
          <span className="text-sm text-slate-400 mb-1.5">kcal 摂取</span>
        </div>
        {plan && (
          <div className="text-right">
            <div className="text-[11px] text-slate-400">{over ? "超過" : "残り"}</div>
            <Num className={`text-xl font-bold ${over ? "text-rose-500" : "text-emerald-600"}`}>{over ? "+" : ""}{Math.abs(round(remain)).toLocaleString()}</Num>
          </div>
        )}
      </div>
      {plan && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${over ? "bg-rose-400" : "bg-emerald-500"}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
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
        <p className="mt-3 text-[11px] text-slate-400">目標期日が未設定のため、目標は維持カロリー基準です。設定で期日を入れると痩せるペースから自動計算されます。</p>
      )}
    </Card>
  );
}

/* --------------------------- Quick meal logging -------------------------- */
function QuickMeal({ db, date, mutate }) {
  const day = getDay(db, date);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState(slotByTime());
  const [toast, setToast] = useState(null);
  const [newFood, setNewFood] = useState(null);
  const tRef = useRef(null);

  const quickList = useMemo(() => {
    const order = [];
    const dates = Object.keys(db.days).sort((a, b) => b.localeCompare(a));
    for (const dt of dates) for (const m of [...db.days[dt].meals].reverse()) if (m.foodId && !order.includes(m.foodId)) order.push(m.foodId);
    db.foods.forEach((f) => { if (!order.includes(f.id)) order.push(f.id); });
    return order.map((id) => db.foods.find((f) => f.id === id)).filter(Boolean).slice(0, 12);
  }, [db.days, db.foods]);

  const results = useMemo(
    () => (q ? db.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []),
    [q, db.foods]
  );

  const log = (food) => {
    const id = uid();
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: [...dy.meals, { id, foodId: food.id, name: food.name, qty: 1, kcal: food.kcal, p: food.p, f: food.f, c: food.c, slot }] })));
    setToast({ name: food.name, mealId: id, slot });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 3000);
  };
  const undo = () => { if (!toast) return; mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.filter((m) => m.id !== toast.mealId) }))); setToast(null); };
  const setQty = (id, delta) => mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.map((m) => (m.id === id ? { ...m, qty: Math.max(1, (m.qty ?? 1) + delta) } : m)) })));
  const del = (id) => mutate((d) => withDay(d, date, (dy) => ({ ...dy, meals: dy.meals.filter((m) => m.id !== id) })));
  const saveNewFood = (food) => { mutate((d) => ({ ...d, foods: [...d.foods, food] })); log(food); };

  const meals = sumMeals(day);
  return (
    <Card className="p-4">
      <SectionLabel right={<span className="text-xs tabular-nums"><span className="font-semibold text-slate-900">{round(meals.kcal)}</span><span className="text-slate-400"> kcal</span></span>}>食事</SectionLabel>

      <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
        {SLOTS.map((s) => {
          const sub = day.meals.filter((m) => mealSlot(m) === s).reduce((a, m) => a + m.kcal * (m.qty ?? 1), 0);
          return (
            <button key={s} onClick={() => setSlot(s)} className={`flex-1 rounded-lg py-1.5 text-center transition ${slot === s ? "bg-white shadow-sm" : ""}`}>
              <div className={`text-xs font-semibold ${slot === s ? "text-slate-900" : "text-slate-500"}`}>{s}</div>
              {sub > 0 && <div className="text-[10px] tabular-nums text-slate-400">{round(sub)}</div>}
            </button>
          );
        })}
      </div>

      <div className="relative mt-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${inputCls} pl-9 mt-0`} placeholder={`「${slot}」に追加 — 検索して即記録`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q && (
        <div className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {results.map((f) => (
            <button key={f.id} onClick={() => { log(f); setQ(""); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-emerald-50 active:bg-emerald-100">
              <div><p className="text-sm text-slate-800">{f.name}</p><p className="text-[11px] text-slate-400 tabular-nums">{f.kcal}kcal · P{f.p} F{f.f} C{f.c}</p></div>
              <Plus size={16} className="text-emerald-600 shrink-0" />
            </button>
          ))}
          <button onClick={() => setNewFood({ name: q, kcal: "", p: "", f: "", c: "", tags: [] })} className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50"><Plus size={15} />「{q}」を新規作成</button>
        </div>
      )}

      {!q && (
        <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {quickList.map((f) => (
            <button key={f.id} onClick={() => log(f)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-2 active:scale-95 active:border-emerald-400 transition">
              <span className="text-[13px] text-slate-700">{shortName(f.name)}</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Plus size={13} /></span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-3">
        {day.meals.length === 0 && <p className="py-3 text-xs text-slate-400">上のスロットを選んで、食べたものを記録しましょう。</p>}
        {SLOTS.map((s) => {
          const items = day.meals.filter((m) => mealSlot(m) === s);
          if (items.length === 0) return null;
          const sub = items.reduce((a, m) => a + m.kcal * (m.qty ?? 1), 0);
          return (
            <div key={s}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-xs font-semibold text-slate-600">{s}</span>
                <Num className="text-[11px] text-slate-400">{round(sub)} kcal</Num>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((m) => {
                  const qy = m.qty ?? 1;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">{m.name}</p>
                        <p className="text-[11px] tabular-nums text-slate-400"><span className="font-medium text-slate-600">{round(m.kcal * qy)}kcal</span>{"  "}P{+(m.p * qy).toFixed(1)} F{+(m.f * qy).toFixed(1)} C{+(m.c * qy).toFixed(1)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setQty(m.id, -1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Minus size={13} /></button>
                        <Num className="w-5 text-center text-sm font-semibold text-slate-700">{qy}</Num>
                        <button onClick={() => setQty(m.id, 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Plus size={13} /></button>
                        <button onClick={() => del(m.id)} className="ml-1 text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
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
            <span className="truncate">{toast.slot}に「{shortName(toast.name)}」を追加</span>
            <button onClick={undo} className="flex shrink-0 items-center gap-1 font-semibold text-emerald-300"><Undo2 size={15} />取り消す</button>
          </div>
        </div>
      )}
      {newFood && <FoodForm initial={newFood} onSave={saveNewFood} onClose={() => setNewFood(null)} />}
    </Card>
  );
}

/* ----------------------------- Log screen -------------------------------- */
function WalkCalc({ weight, onApply }) {
  const [min, setMin] = useState("");
  const [met, setMet] = useState("3.5");
  const kcal = round(n(met) * n(weight) * (n(min) / 60));
  return (
    <div className="rounded-xl bg-slate-50 p-3 mb-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2"><Calculator size={14} /> ウォーキング概算</div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="時間(分)"><input className={inputCls} type="number" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
        <Field label="強度MET" hint="散歩3.0/早歩き4.3"><input className={inputCls} type="number" step="0.1" value={met} onChange={(e) => setMet(e.target.value)} /></Field>
        <div className="flex flex-col justify-end">
          <span className="text-xs text-slate-400">≒ <Num className="font-semibold text-slate-700">{kcal}</Num> kcal</span>
          <button disabled={!kcal} onClick={() => onApply(kcal)} className="mt-1 rounded-lg bg-slate-900 disabled:opacity-30 px-2 py-1.5 text-xs font-semibold text-white">反映</button>
        </div>
      </div>
    </div>
  );
}

function ActivityForm({ weight, onAdd, onClose }) {
  const [label, setLabel] = useState("");
  const [kcal, setKcal] = useState("");
  return (
    <Modal title="活動・消費を記録" onClose={onClose}>
      <WalkCalc weight={weight} onApply={(k) => { setKcal(String(k)); if (!label) setLabel("ウォーキング"); }} />
      <Field label="活動名"><input className={inputCls} placeholder="ウォーキング / 通勤 / アクティブエネルギー など" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <div className="mt-2"><Field label="消費kcal"><input className={inputCls} type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field></div>
      <button disabled={!label || kcal === ""} onClick={() => { onAdd({ id: uid(), label, kcal: n(kcal) }); onClose(); }} className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white">追加</button>
    </Modal>
  );
}

function LogScreen({ db, date, setDate, mutate }) {
  const day = getDay(db, date);
  const [actOpen, setActOpen] = useState(false);
  const [section, setSection] = useState("食事");
  const lw = latestWeight(db, date);
  const wToday = db.weightLog.find((w) => w.date === date)?.weight ?? "";
  const [wInput, setWInput] = useState("");
  useEffect(() => { setWInput(wToday === "" ? "" : String(wToday)); }, [date, wToday]);

  const plan = targetPlan(db);
  const meals = sumMeals(day);
  const weightDone = wToday !== "";
  const actCount = day.activities.length;
  const bmrDate = db.profile && lw ? bmrCalc(db.profile.sex, db.profile.age, db.profile.heightCm, lw) : 0;
  const actKcal = sumActivities(day);

  const saveWeight = () => { if (wInput === "") return; mutate((d) => ({ ...d, weightLog: [...d.weightLog.filter((w) => w.date !== date), { date, weight: n(wInput) }] })); };
  const addAct = (a) => mutate((d) => withDay(d, date, (dy) => ({ ...dy, activities: [...dy.activities, a] })));
  const delAct = (id) => mutate((d) => withDay(d, date, (dy) => ({ ...dy, activities: dy.activities.filter((m) => m.id !== id) })));

  const TABS_L = [
    { id: "食事", badge: day.meals.length || null },
    { id: "体重", badge: weightDone ? "✓" : null },
    { id: "活動", badge: actCount || null },
  ];

  return (
    <div className="pb-4">
      <DateNav date={date} setDate={setDate} />
      <div className="space-y-4 px-4">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS_L.map((t) => (
            <button key={t.id} onClick={() => setSection(t.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${section === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {t.id}
              {t.badge != null && <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${section === t.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {section === "食事" && (
          <>
            <DailySummary intake={meals} plan={plan} />
            <QuickMeal db={db} date={date} mutate={mutate} />
          </>
        )}

        {section === "体重" && (
          <Card className="p-4">
            <SectionLabel right={lw != null ? <span className="text-xs tabular-nums text-slate-400">前回 {lw}kg</span> : null}>体重（必須）</SectionLabel>
            <div className="mt-2 flex gap-2">
              <input className={`${inputCls} mt-0`} type="number" step="0.1" inputMode="decimal" placeholder="kg" value={wInput} onChange={(e) => setWInput(e.target.value)} />
              <button onClick={saveWeight} disabled={wInput === ""} className="shrink-0 rounded-xl bg-slate-900 disabled:opacity-30 px-4 text-sm font-semibold text-white">保存</button>
            </div>
            {weightDone && <p className="mt-2 text-[11px] text-emerald-600">この日の体重は記録済みです。</p>}
          </Card>
        )}

        {section === "活動" && (
          <Card className="p-4">
            <SectionLabel right={<button onClick={() => setActOpen(true)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"><Plus size={14} />追加</button>}>活動</SectionLabel>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="text-xs text-slate-500">消費 = 基礎代謝 + 活動</span>
              <span className="text-xs tabular-nums">
                <span className="text-slate-400">{round(bmrDate).toLocaleString()} + </span>
                <span className="font-semibold text-emerald-600">{round(actKcal)}</span>
                <span className="text-slate-400"> = </span>
                <span className="text-sm font-bold text-slate-900">{round(bmrDate + actKcal).toLocaleString()}</span>
              </span>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {day.activities.length === 0 && <p className="py-3 text-xs text-slate-400">基礎代謝に加算される運動・歩行を記録。</p>}
              {day.activities.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2">
                  <p className="text-sm text-slate-800">{a.label}</p>
                  <div className="flex items-center gap-2"><Num className="text-sm font-semibold text-slate-700">+{a.kcal}</Num><button onClick={() => delAct(a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></div>
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

/* --------------------------- Workout screen ------------------------------ */
function WorkoutForm({ onAdd, onClose }) {
  const [ex, setEx] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const valid = ex && weight !== "" && reps !== "" && sets !== "";
  return (
    <Modal title="種目を記録" onClose={onClose}>
      <Field label="種目"><input className={inputCls} placeholder="ベンチプレス / スクワット など" value={ex} onChange={(e) => setEx(e.target.value)} /></Field>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="重量(kg)"><input className={inputCls} type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        <Field label="回数"><input className={inputCls} type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></Field>
        <Field label="セット"><input className={inputCls} type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} /></Field>
      </div>
      <button disabled={!valid} onClick={() => { onAdd({ id: uid(), ex, weight: n(weight), reps: n(reps), sets: n(sets) }); onClose(); }} className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white">追加</button>
    </Modal>
  );
}

function WorkoutScreen({ db, date, setDate, mutate }) {
  const day = getDay(db, date);
  const [open, setOpen] = useState(false);
  const add = (w) => mutate((d) => withDay(d, date, (dy) => ({ ...dy, workouts: [...dy.workouts, w] })));
  const del = (id) => mutate((d) => withDay(d, date, (dy) => ({ ...dy, workouts: dy.workouts.filter((w) => w.id !== id) })));
  const totalVol = day.workouts.reduce((a, w) => a + w.weight * w.reps * w.sets, 0);
  return (
    <div className="pb-4">
      <DateNav date={date} setDate={setDate} />
      <div className="px-4 space-y-4">
        <Card className="p-5">
          <SectionLabel>今日のトレーニング</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 py-3"><div className="text-[11px] text-slate-400">種目数</div><Num className="text-2xl font-bold text-slate-900">{day.workouts.length}</Num></div>
            <div className="rounded-xl bg-slate-50 py-3"><div className="text-[11px] text-slate-400">総挙上量</div><Num className="text-2xl font-bold text-slate-900">{round(totalVol).toLocaleString()}</Num><span className="text-xs text-slate-400"> kg</span></div>
          </div>
        </Card>
        <Card className="p-4">
          <SectionLabel right={<button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"><Plus size={14} />追加</button>}>種目</SectionLabel>
          <div className="mt-2 divide-y divide-slate-100">
            {day.workouts.length === 0 && <p className="py-3 text-xs text-slate-400">この日の筋トレを記録しましょう。</p>}
            {day.workouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2.5">
                <div><p className="text-sm font-medium text-slate-800">{w.ex}</p><p className="text-[11px] text-slate-400 tabular-nums">{w.weight}kg × {w.reps}回 × {w.sets}セット</p></div>
                <div className="flex items-center gap-2"><Num className="text-xs text-slate-400">{round(w.weight * w.reps * w.sets)}kg</Num><button onClick={() => del(w.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {open && <WorkoutForm onAdd={add} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ----------------------------- Food DB ----------------------------------- */
function FoodForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", kcal: "", p: "", f: "", c: "", tags: [] });
  const toggle = (t) => setF((s) => ({ ...s, tags: s.tags.includes(t) ? s.tags.filter((x) => x !== t) : [...s.tags, t] }));
  const valid = f.name && f.kcal !== "" && f.p !== "" && f.f !== "" && f.c !== "";
  return (
    <Modal title={initial?.id ? "食品を編集" : "食品を追加"} onClose={onClose}>
      <Field label="名称（1食分の分量込み）"><input className={inputCls} placeholder="例: サラダチキン 1個" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Field label="kcal"><input className={inputCls} type="number" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} /></Field>
        <Field label="P(g)"><input className={inputCls} type="number" value={f.p} onChange={(e) => setF({ ...f, p: e.target.value })} /></Field>
        <Field label="F(g)"><input className={inputCls} type="number" value={f.f} onChange={(e) => setF({ ...f, f: e.target.value })} /></Field>
        <Field label="C(g)"><input className={inputCls} type="number" value={f.c} onChange={(e) => setF({ ...f, c: e.target.value })} /></Field>
      </div>
      <div className="mt-3">
        <span className="text-xs font-medium text-slate-500">タグ</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TAGS.map((t) => <button key={t.id} onClick={() => toggle(t.id)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${f.tags.includes(t.id) ? t.cls : "bg-slate-100 text-slate-400"}`}>{t.label}</button>)}
        </div>
      </div>
      <button disabled={!valid} onClick={() => { onSave({ ...f, kcal: n(f.kcal), p: n(f.p), f: n(f.f), c: n(f.c), id: f.id || uid() }); onClose(); }} className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white">保存</button>
    </Modal>
  );
}

function FoodScreen({ db, mutate }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [edit, setEdit] = useState(undefined);

  const list = useMemo(() => {
    let arr = db.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
    if (filter !== "all") arr = arr.filter((f) => f.tags.includes(filter));
    if (sort === "kcal") arr = [...arr].sort((a, b) => a.kcal - b.kcal);
    else if (sort === "pratio") arr = [...arr].sort((a, b) => b.p / (b.kcal || 1) - a.p / (a.kcal || 1));
    else arr = [...arr].sort((a, b) => a.name.localeCompare(b.name, "ja"));
    return arr;
  }, [db.foods, q, filter, sort]);

  const save = (food) => mutate((d) => {
    const exists = d.foods.some((x) => x.id === food.id);
    return { ...d, foods: exists ? d.foods.map((x) => (x.id === food.id ? food : x)) : [...d.foods, food] };
  });
  const del = (id) => mutate((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }));

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur px-4 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-9 mt-0`} placeholder="食品を検索" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[{ id: "all", label: "すべて" }, ...TAGS].map((t) => (
            <button key={t.id} onClick={() => setFilter(t.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${filter === t.id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">並び替え</span>
          {[["name", "名前"], ["kcal", "低kcal順"], ["pratio", "高タンパク順"]].map(([k, l]) => (
            <button key={k} onClick={() => setSort(k)} className={`rounded-md px-2 py-0.5 ${sort === k ? "bg-emerald-100 text-emerald-700 font-semibold" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="px-4 space-y-2 mt-1">
        {list.map((f) => (
          <Card key={f.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{f.name}</p>
                <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">{f.kcal}kcal · P{f.p} F{f.f} C{f.c}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {f.tags.map((t) => { const tag = TAGS.find((x) => x.id === t); return tag ? <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tag.cls}`}>{tag.label}</span> : null; })}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEdit(f)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Pencil size={15} /></button>
                <button onClick={() => del(f.id)} className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500 hover:bg-slate-100"><Trash2 size={15} /></button>
              </div>
            </div>
          </Card>
        ))}
        {list.length === 0 && <p className="py-6 text-center text-xs text-slate-400">該当なし。右下の＋で追加できます。</p>}
        <p className="pt-1 text-center text-[10px] text-slate-300">数値はサンプル/ユーザー登録です。実際の表示を確認のうえ編集してください。</p>
      </div>
      <button onClick={() => setEdit(null)} className="fixed bottom-24 right-5 z-20 flex items-center justify-center rounded-full bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-600/30"><Plus size={22} /></button>
      {edit !== undefined && <FoodForm initial={edit} onSave={save} onClose={() => setEdit(undefined)} />}
    </div>
  );
}

/* ----------------------------- Settings ---------------------------------- */
function SettingsModal({ db, mutate, onClose }) {
  const p = db.profile || { sex: "male", age: "", heightCm: "", goalWeight: "", targetDate: "" };
  const [f, setF] = useState({ ...p, targetDate: p.targetDate || "" });
  const lw = latestWeight(db);
  const m = maintenanceKcal(db);
  const tomorrow = shiftDate(todayStr(), 1);

  const preview = useMemo(() => {
    if (!lw || f.age === "" || f.heightCm === "" || f.goalWeight === "") return null;
    const bmr = bmrCalc(f.sex, n(f.age), n(f.heightCm), lw);
    const maint = m ? m.kcal : Math.round(bmr * COLDSTART_FACTOR);
    const kg = Math.max(0, +(lw - n(f.goalWeight)).toFixed(2));
    const maxDef = Math.max(0, maint - bmr);
    const days = f.targetDate ? daysBetween(todayStr(), f.targetDate) : null;
    let def = 0, unreal = false, future = days == null || days > 0;
    if (days && days > 0 && kg > 0) { def = (kg * KCAL_PER_KG) / days; if (def > maxDef) { unreal = true; def = maxDef; } }
    const target = Math.round(Math.max(maint - def, bmr));
    const minDays = kg > 0 && maxDef > 0 ? Math.ceil((kg * KCAL_PER_KG) / maxDef) : null;
    const pro = Math.round(lw * 2.0), fat = Math.round((target * 0.25) / 9);
    const carb = Math.max(0, Math.round((target - pro * 4 - fat * 9) / 4));
    return { bmr, maint, source: m ? m.source : "estimate", target, def: Math.round(def), pro, fat, carb, unreal, minDays, days, future, kg };
  }, [f, lw, m]);

  const valid = f.age !== "" && f.heightCm !== "" && f.goalWeight !== "";
  return (
    <Modal title="プロフィール・目標設定" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="性別">
          <select className={inputCls} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}>
            <option value="male">男性</option><option value="female">女性</option>
          </select>
        </Field>
        <Field label="年齢"><input className={inputCls} type="number" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></Field>
        <Field label="身長(cm)"><input className={inputCls} type="number" value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} /></Field>
        <Field label="目標体重(kg)"><input className={inputCls} type="number" step="0.1" value={f.goalWeight} onChange={(e) => setF({ ...f, goalWeight: e.target.value })} /></Field>
      </div>
      <div className="mt-2">
        <Field label="目標期日（いつまでに）" hint="ここから痩せるペースと1日の目標を自動計算">
          <input className={inputCls} type="date" min={tomorrow} value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} />
        </Field>
      </div>

      {preview && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><Target size={14} />自動算出</div>
          <div className="mt-2 space-y-1 text-xs text-emerald-900/90">
            <div className="flex justify-between"><span>維持カロリー{preview.source === "estimate" ? "（初期推定）" : "（実測平均）"}</span><Num className="font-semibold">{preview.maint.toLocaleString()} kcal</Num></div>
            {preview.days && preview.days > 0 && preview.kg > 0 && (
              <div className="flex justify-between"><span>1日の赤字（ペース）</span><Num className="font-semibold">−{preview.def.toLocaleString()} kcal</Num></div>
            )}
            <div className="flex justify-between border-t border-emerald-200/70 pt-1"><span className="font-semibold">目標カロリー</span><Num className="font-bold text-emerald-700">{preview.target.toLocaleString()} kcal</Num></div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            {[["P", preview.pro], ["F", preview.fat], ["C", preview.carb]].map(([l, v]) => (
              <div key={l}><div className="text-[10px] text-emerald-600">{l}</div><Num className="text-sm font-bold text-emerald-800">{v}g</Num></div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-emerald-600/80">基礎代謝 {preview.bmr.toLocaleString()}kcal / タンパク質は体重×2g目安</p>
        </div>
      )}

      {preview && preview.days != null && preview.days <= 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">目標期日は未来の日付を選んでください。</p>
      )}
      {preview && preview.unreal && preview.minDays && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
          このペースは速すぎます（目標が基礎代謝を下回るため下限で調整中）。現実的な最短は約{preview.minDays}日後、
          <span className="font-semibold"> {fmtDate(shiftDate(todayStr(), preview.minDays)).slice(0, -3)}頃</span>です。
        </p>
      )}

      <button disabled={!valid} onClick={() => { mutate((d) => ({ ...d, profile: { sex: f.sex, age: n(f.age), heightCm: n(f.heightCm), goalWeight: n(f.goalWeight), targetDate: f.targetDate || null } })); onClose(); }} className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white">保存</button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => { if (confirm("デモデータで上書きします。よろしいですか？")) { mutate(() => demoDB()); onClose(); } }} className="rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600">デモを再読み込み</button>
        <button onClick={() => { if (confirm("すべての記録を削除します。よろしいですか？")) { mutate(() => defaultDB()); onClose(); } }} className="rounded-xl border border-rose-200 py-2.5 text-xs font-semibold text-rose-500">データを初期化</button>
      </div>
    </Modal>
  );
}

/* -------------------------------- App ------------------------------------ */
const TABS = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "log", label: "記録", icon: NotebookPen },
  { id: "workout", label: "筋トレ", icon: Dumbbell },
  { id: "food", label: "食品", icon: Database },
];

export default function App() {
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState("home");
  const [date, setDate] = useState(todayStr());
  const [settings, setSettings] = useState(false);

  useEffect(() => { (async () => { const loaded = await store.load(); setDb(loaded || demoDB()); })(); }, []);
  const mutate = useCallback((fn) => { setDb((prev) => { const next = fn(prev); store.save(next); return next; }); }, []);

  if (!db) return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">読み込み中…</div>;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 text-slate-900" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/70 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold tracking-tight"><span className="text-emerald-600">収支</span>ダイエット</h1>
        <button onClick={() => setSettings(true)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><Settings size={20} /></button>
      </header>
      <main className="flex-1">
        {tab === "home" && <HomeScreen db={db} openSettings={() => setSettings(true)} />}
        {tab === "log" && <LogScreen db={db} date={date} setDate={setDate} mutate={mutate} />}
        {tab === "workout" && <WorkoutScreen db={db} date={date} setDate={setDate} mutate={mutate} />}
        {tab === "food" && <FoodScreen db={db} mutate={mutate} />}
      </main>
      <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-emerald-600" : "text-slate-400"}`}>
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />{t.label}
            </button>
          );
        })}
      </nav>
      {settings && <SettingsModal db={db} mutate={mutate} onClose={() => setSettings(false)} />}
    </div>
  );
}
