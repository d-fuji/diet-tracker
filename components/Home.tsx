"use client";

// ホーム（俯瞰・閲覧専用）: 今日の収支カード ＋ 目標体重までカード。
// メモ化は React Compiler に委ねるため手動の useMemo は使わない。
import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Cell,
} from "recharts";
import { Share2, ChevronLeft, ChevronRight } from "lucide-react";
import type { DB } from "@/types";
import { bmrCalc, getDay, hasRecord, latestWeight, sumMeals, sumActivities } from "@/lib/calc";
import {
  KCAL_PER_KG,
  round,
  shiftDate,
  todayStr,
  fmtDate,
  daysBetween,
} from "@/lib/format";
import { buildShareText, shareSummary, type ShareGoal } from "@/lib/share";
import { Card, Num, SectionLabel } from "@/components/ui";

/** 今日のサマリーを SNS/友達に共有するボタン（Web Share API、非対応時はコピー）。 */
function ShareButton({ text }: { text: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tRef.current) clearTimeout(tRef.current); }, []);

  async function onShare() {
    const result = await shareSummary(text);
    if (result === "cancelled") return;
    setFeedback(
      result === "shared"
        ? "共有しました"
        : result === "copied"
          ? "サマリーをコピーしました"
          : "共有できませんでした",
    );
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setFeedback(null), 2500);
  }

  return (
    <>
      <button
        onClick={onShare}
        className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 active:bg-slate-200"
        aria-label="今日のサマリーを共有"
      >
        <Share2 size={13} />
        共有
      </button>
      {feedback && (
        <div
          className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
            {feedback}
          </div>
        </div>
      )}
    </>
  );
}

interface WeekDatum {
  date: string;
  /** 記録なしの日は null（バーを描かずギャップにする）。 */
  bal: number | null;
  recorded: boolean;
}

/** 収支カードのヘッダー（前日/翌日ナビ＋日付ラベル＋共有 or 未記入バッジ）。 */
function LedgerHeader({
  date,
  setDate,
  recorded,
  shareText,
}: {
  date: string;
  setDate: (d: string) => void;
  recorded: boolean;
  shareText: string;
}) {
  const isToday = date === todayStr();
  const label = isToday ? "今日の収支" : `${fmtDate(date)}の収支`;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setDate(shiftDate(date, -1))}
          className="-ml-1 rounded-full p-1 text-slate-400 hover:bg-slate-100"
          aria-label="前日"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <button
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={isToday}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
          aria-label="翌日"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {!isToday && (
          <button
            onClick={() => setDate(todayStr())}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 active:bg-slate-200"
          >
            今日へ
          </button>
        )}
        {recorded ? (
          <ShareButton text={shareText} />
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            未記入
          </span>
        )}
      </div>
    </div>
  );
}

/** 選択日の収支（大きな収支数値＋摂取/消費2本バー＋直近7日の収支バー）。 */
function Ledger({
  date,
  setDate,
  burned,
  intake,
  weekData,
  recorded,
  shareText,
}: {
  date: string;
  setDate: (d: string) => void;
  burned: number;
  intake: number;
  weekData: WeekDatum[];
  recorded: boolean;
  shareText: string;
}) {
  const isToday = date === todayStr();
  if (!recorded) {
    return (
      <Card className="p-5">
        <LedgerHeader date={date} setDate={setDate} recorded={recorded} shareText={shareText} />
        <div className="mt-1 flex items-end gap-1.5">
          <Num className="text-4xl font-bold text-slate-300">−−−</Num>
          <span className="text-sm text-slate-300 mb-1.5">kcal</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          {isToday
            ? "まだ記録がありません。食事を記録すると今日の収支が表示されます。"
            : "この日の記録はありません。"}
        </p>
        <Week weekData={weekData} isToday={isToday} />
      </Card>
    );
  }

  const balance = burned - intake;
  const deficit = balance >= 0;
  const max = Math.max(intake, burned, 1);
  const bars = [
    { label: "摂取", val: intake, cls: intake > burned ? "bg-rose-400" : "bg-slate-400" },
    { label: "消費", val: burned, cls: "bg-emerald-500" },
  ];
  return (
    <Card className="p-5">
      <LedgerHeader date={date} setDate={setDate} recorded={recorded} shareText={shareText} />
      <div className="mt-1 flex items-end gap-1.5">
        <Num className={`text-4xl font-bold ${deficit ? "text-emerald-600" : "text-rose-500"}`}>
          {deficit ? "−" : "+"}
          {Math.abs(round(balance)).toLocaleString()}
        </Num>
        <span className="text-sm text-slate-400 mb-1.5">kcal</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2.5">
            <span className="w-7 shrink-0 text-[11px] font-medium text-slate-500">{b.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${b.cls}`} style={{ width: `${(b.val / max) * 100}%` }} />
            </div>
            <Num className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700">
              {round(b.val).toLocaleString()}
            </Num>
          </div>
        ))}
      </div>
      <Week weekData={weekData} isToday={isToday} />
    </Card>
  );
}

/** 選択日までの7日の収支バー。記録なしの日はバーを描かずギャップにして「未記入」を示す。 */
function Week({ weekData, isToday = true }: { weekData: WeekDatum[]; isToday?: boolean }) {
  if (weekData.length <= 1) return null;
  const anyUnrecorded = weekData.some((d) => !d.recorded);
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{isToday ? "直近7日の推移" : "この日までの7日"}</span>
        <span className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />
            消費が多い
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-500" />
            摂取が多い
          </span>
          {anyUnrecorded && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm border border-dashed border-slate-300" />
              未記入
            </span>
          )}
        </span>
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekData} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={({ x, y, payload, index }) => {
                const unrecorded = !weekData[index]?.recorded;
                return (
                  <text
                    x={x}
                    y={Number(y) + 10}
                    textAnchor="middle"
                    fontSize={10}
                    fill={unrecorded ? "#cbd5e1" : "#94a3b8"}
                  >
                    {payload.value}
                  </text>
                );
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Bar dataKey="bal" radius={[4, 4, 4, 4]}>
              {weekData.map((d, i) => (
                <Cell key={i} fill={(d.bal ?? 0) >= 0 ? "#10b981" : "#f43f5e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 目標体重まで（残りkg≈kcal、開始/現在/目標、30日折れ線、フッターに成果と達成ペース）。 */
function GoalProgress({ db }: { db: DB }) {
  const sorted = [...db.weightLog].sort((a, b) => a.date.localeCompare(b.date));
  if (!db.profile || sorted.length === 0) return null;
  const start = sorted[0].weight;
  const cur = sorted[sorted.length - 1].weight;
  const goal = db.profile.goalWeight;
  const done = start - cur;
  const toGo = cur - goal;
  const reached = cur <= goal;
  const toGoKg = Math.max(0, toGo);
  const doneKcal = Math.round(Math.max(0, done) * KCAL_PER_KG);
  const remainKcal = Math.round(toGoKg * KCAL_PER_KG);

  const td = db.profile.targetDate;
  let dailyNeed: number | null = null;
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
      <SectionLabel
        right={
          td ? <span className="text-xs tabular-nums text-slate-400">期日 {fmtDate(td).slice(0, -3)}</span> : null
        }
      >
        目標体重まで
      </SectionLabel>
      <div className="mt-1 flex items-end gap-1.5">
        {reached ? (
          <Num className="text-3xl font-bold text-emerald-600">達成 🎉</Num>
        ) : (
          <>
            <span className="text-sm text-slate-400 mb-1.5">あと</span>
            <Num className="text-4xl font-bold text-slate-900">{toGoKg.toFixed(1)}</Num>
            <span className="text-sm text-slate-400 mb-1.5">kg</span>
            <span className="ml-1 mb-1.5 text-xs tabular-nums text-slate-400">
              ≈ {remainKcal.toLocaleString()} kcal
            </span>
          </>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 py-2">
          <div className="text-[11px] text-slate-400">開始</div>
          <div>
            <Num className="text-base font-semibold text-slate-700">{start}</Num>
            <span className="text-[11px] text-slate-400"> kg</span>
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 py-2">
          <div className="text-[11px] text-emerald-600/90">現在</div>
          <div>
            <Num className="text-base font-bold text-emerald-700">{cur}</Num>
            <span className="text-[11px] text-emerald-600/90"> kg</span>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 py-2">
          <div className="text-[11px] text-slate-400">目標</div>
          <div>
            <Num className="text-base font-semibold text-slate-700">{goal}</Num>
            <span className="text-[11px] text-slate-400"> kg</span>
          </div>
        </div>
      </div>
      {data.length > 1 && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis
                domain={[yMin, yMax]}
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <ReferenceLine y={goal} stroke="#10b981" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="weight" name="体重" stroke="#0f172a" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">これまでの成果</span>
          <span className="tabular-nums">
            <span className="font-semibold text-emerald-600">{Math.max(0, done).toFixed(1)} kg</span>
            <span className="text-slate-400"> ≈ {doneKcal.toLocaleString()} kcal</span>
          </span>
        </div>
        {dailyNeed != null && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">達成ペース</span>
            <span className="tabular-nums">
              <span className="font-bold text-emerald-600">1日 −{dailyNeed.toLocaleString()}kcal</span>
              <span className="text-slate-400"> の収支</span>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

export function HomeScreen({ db, openSettings }: { db: DB; openSettings: () => void }) {
  // 収支カードは過去日も遡れる（閲覧専用）。デフォルトは今日。
  const [date, setDate] = useState(todayStr());
  const day = getDay(db, date);
  const lw = latestWeight(db, date);
  const profile = db.profile;
  const bmr = profile && lw ? bmrCalc(profile.sex, profile.age, profile.heightCm, lw) : 0;
  const meals = sumMeals(day);
  const burned = bmr + sumActivities(day);
  const recorded = hasRecord(day);

  const balanceData: WeekDatum[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(date, -i);
    const dy = getDay(db, d);
    const w = latestWeight(db, d) ?? lw;
    const b =
      (profile && w ? bmrCalc(profile.sex, profile.age, profile.heightCm, w) : 0) + sumActivities(dy);
    const dayRecorded = hasRecord(dy);
    balanceData.push({
      date: fmtDate(d).slice(0, -3),
      bal: dayRecorded ? round(b - sumMeals(dy).kcal) : null,
      recorded: dayRecorded,
    });
  }

  // 共有用サマリー（体重・目標進捗は選択日時点の値で算出して収支と整合させる）。
  const sortedW = [...db.weightLog]
    .filter((w) => w.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  let shareGoal: ShareGoal | null = null;
  if (profile && sortedW.length > 0) {
    const start = sortedW[0].weight;
    const cur = sortedW[sortedW.length - 1].weight;
    shareGoal = {
      cur,
      done: Math.max(0, start - cur),
      toGo: Math.max(0, cur - profile.goalWeight),
      reached: cur <= profile.goalWeight,
    };
  }
  const shareText = buildShareText({
    date,
    balance: burned - meals.kcal,
    intake: meals.kcal,
    burned,
    goal: shareGoal,
  });

  if (!profile) {
    return (
      <div className="px-4 pt-8">
        <Card className="p-6 text-center">
          <p className="text-slate-600 text-sm leading-relaxed">
            最初にプロフィール（性別・年齢・身長・目標体重）を登録すると、基礎代謝・収支・PFC目標が計算されます。
          </p>
          <button
            onClick={openSettings}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            プロフィールを登録
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-2 pb-4">
      <Ledger
        date={date}
        setDate={setDate}
        burned={burned}
        intake={meals.kcal}
        weekData={balanceData}
        recorded={recorded}
        shareText={shareText}
      />
      <GoalProgress db={db} />
    </div>
  );
}
