"use client";

// 筋トレ（ログ専用・消費には加算しない）: 日付ナビ＋種目数/総挙上量サマリー＋種目リスト。
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DB, Workout, Mutate } from "@/types";
import { getDay, withDay } from "@/lib/calc";
import { uid, n, round, fmtDate } from "@/lib/format";
import { Card, Num, SectionLabel, Field, Modal, ConfirmDialog, inputCls } from "@/components/ui";
import { DateNav } from "@/components/DateNav";

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
  const [open, setOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Workout | null>(null);
  const add = (w: Workout) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, workouts: [...dy.workouts, w] })));
  const remove = (id: string) =>
    mutate((d) => withDay(d, date, (dy) => ({ ...dy, workouts: dy.workouts.filter((w) => w.id !== id) })));
  const totalVol = day.workouts.reduce((a, w) => a + w.weight * w.reps * w.sets, 0);
  const isToday = date === today;
  return (
    <div className="pb-4">
      <DateNav date={date} setDate={setDate} today={today} />
      <div className="px-4 space-y-4">
        <Card className="p-5">
          <SectionLabel>{isToday ? "今日のトレーニング" : `${fmtDate(date)}のトレーニング`}</SectionLabel>
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
              <div key={w.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{w.ex}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {w.weight}kg × {w.reps}回 × {w.sets}セット
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Num className="text-xs text-slate-400">{round(w.weight * w.reps * w.sets)}kg</Num>
                  <button
                    onClick={() => setDelTarget(w)}
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
      </div>
      {open && <WorkoutForm onAdd={add} onClose={() => setOpen(false)} />}
      {delTarget && (
        <ConfirmDialog
          title="種目を削除"
          message={`「${delTarget.ex}」(${delTarget.weight}kg × ${delTarget.reps}回 × ${delTarget.sets}セット) を削除します。よろしいですか？`}
          onConfirm={() => remove(delTarget.id)}
          onClose={() => setDelTarget(null)}
        />
      )}
    </div>
  );
}
