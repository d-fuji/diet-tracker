"use client";

// 筋トレ（ログ専用・消費には加算しない）: 日付ナビ＋種目数/総挙上量サマリー＋種目リスト。
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DB, Workout, Mutate } from "@/types";
import { getDay, withDay } from "@/lib/calc";
import { uid, n, round } from "@/lib/format";
import { Card, Num, SectionLabel, Field, Modal, Button, Input, Stat, Separator } from "@/components/ui";
import { DateNav } from "@/components/DateNav";

function WorkoutForm({ onAdd, onClose }: { onAdd: (w: Workout) => void; onClose: () => void }) {
  const [ex, setEx] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const valid = ex && weight !== "" && reps !== "" && sets !== "";
  return (
    <Modal title="種目を記録" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="種目">
          <Input
            placeholder="ベンチプレス / スクワット など"
            value={ex}
            onChange={(e) => setEx(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="重量(kg)">
            <Input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="回数">
            <Input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="セット">
            <Input type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
        </div>
        <Button
          variant="primary"
          fullWidth
          isDisabled={!valid}
          className="mt-1"
          onPress={() => {
            onAdd({ id: uid(), ex, weight: n(weight), reps: n(reps), sets: n(sets) });
            onClose();
          }}
        >
          追加
        </Button>
      </div>
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="種目数">
              <Num className="text-2xl font-bold">{day.workouts.length}</Num>
            </Stat>
            <Stat label="総挙上量">
              <Num className="text-2xl font-bold">{round(totalVol).toLocaleString()}</Num>
              <span className="text-xs text-muted"> kg</span>
            </Stat>
          </div>
        </Card>
        <Card className="p-4">
          <SectionLabel
            right={
              <Button variant="primary" size="sm" onPress={() => setOpen(true)}>
                <Plus size={14} />
                追加
              </Button>
            }
          >
            種目
          </SectionLabel>
          <div className="mt-2">
            {day.workouts.length === 0 && (
              <p className="py-3 text-xs text-muted">この日の筋トレを記録しましょう。</p>
            )}
            {day.workouts.map((w, i) => (
              <div key={w.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.ex}</p>
                    <p className="text-[11px] text-muted tabular-nums">
                      {w.weight}kg × {w.reps}回 × {w.sets}セット
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Num className="text-xs text-muted">{round(w.weight * w.reps * w.sets)}kg</Num>
                    <Button isIconOnly variant="ghost" size="sm" aria-label="削除" onPress={() => del(w.id)}>
                      <Trash2 size={16} className="text-muted" />
                    </Button>
                  </div>
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
