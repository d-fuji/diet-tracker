"use client";

// 筋トレ（ログ専用・消費には加算しない）: 日付ナビ＋種目数/総挙上量サマリー＋種目リスト。
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import type { DB, Workout } from "@/types";
import { getDay, withDay } from "@/lib/calc";
import { uid, n, round, shiftDate, todayStr, fmtDate } from "@/lib/format";
import { Card, Num, SectionLabel, Field, Modal, inputCls } from "@/components/ui";

type Mutate = (fn: (prev: DB) => DB) => void;

function DateNav({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <button
        onClick={() => setDate(shiftDate(date, -1))}
        className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
        aria-label="前日"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => setDate(todayStr())}
        className="min-w-[110px] text-center text-sm font-semibold text-slate-900"
      >
        {date === todayStr() ? "今日 " : ""}
        {fmtDate(date)}
      </button>
      <button
        onClick={() => setDate(shiftDate(date, 1))}
        className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
        aria-label="翌日"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function WorkoutForm({ onAdd, onClose }: { onAdd: (w: Workout) => void; onClose: () => void }) {
  const [ex, setEx] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const valid = ex && weight !== "" && reps !== "" && sets !== "";
  return (
    <Modal title="種目を記録" onClose={onClose}>
      <Field label="種目">
        <input
          className={inputCls}
          placeholder="ベンチプレス / スクワット など"
          value={ex}
          onChange={(e) => setEx(e.target.value)}
        />
      </Field>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Field label="重量(kg)">
          <input
            className={inputCls}
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </Field>
        <Field label="回数">
          <input
            className={inputCls}
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </Field>
        <Field label="セット">
          <input
            className={inputCls}
            type="number"
            inputMode="numeric"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </Field>
      </div>
      <button
        disabled={!valid}
        onClick={() => {
          onAdd({ id: uid(), ex, weight: n(weight), reps: n(reps), sets: n(sets) });
          onClose();
        }}
        className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white"
      >
        追加
      </button>
    </Modal>
  );
}

export function WorkoutScreen({
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
  const [open, setOpen] = useState(false);
  const add = (w: Workout) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, workouts: [...dy.workouts, w] })));
  const del = (id: string) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, workouts: dy.workouts.filter((w) => w.id !== id) })));
  const totalVol = day.workouts.reduce((a, w) => a + w.weight * w.reps * w.sets, 0);
  return (
    <div className="pb-4">
      <DateNav date={date} setDate={setDate} />
      <div className="px-4 space-y-4">
        <Card className="p-5">
          <SectionLabel>今日のトレーニング</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 py-3">
              <div className="text-[11px] text-slate-400">種目数</div>
              <Num className="text-2xl font-bold text-slate-900">{day.workouts.length}</Num>
            </div>
            <div className="rounded-xl bg-slate-50 py-3">
              <div className="text-[11px] text-slate-400">総挙上量</div>
              <Num className="text-2xl font-bold text-slate-900">{round(totalVol).toLocaleString()}</Num>
              <span className="text-xs text-slate-400"> kg</span>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <SectionLabel
            right={
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                <Plus size={14} />
                追加
              </button>
            }
          >
            種目
          </SectionLabel>
          <div className="mt-2 divide-y divide-slate-100">
            {day.workouts.length === 0 && (
              <p className="py-3 text-xs text-slate-400">この日の筋トレを記録しましょう。</p>
            )}
            {day.workouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{w.ex}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {w.weight}kg × {w.reps}回 × {w.sets}セット
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Num className="text-xs text-slate-400">{round(w.weight * w.reps * w.sets)}kg</Num>
                  <button
                    onClick={() => del(w.id)}
                    className="text-slate-300 hover:text-rose-500"
                    aria-label="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {open && <WorkoutForm onAdd={add} onClose={() => setOpen(false)} />}
    </div>
  );
}
