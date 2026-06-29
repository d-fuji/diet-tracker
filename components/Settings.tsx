"use client";

// 設定: プロフィール（性別/年齢/身長/目標体重/目標期日）＋自動算出プレビュー＋デモ/初期化。
import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import type { DB, Sex } from "@/types";
import { bmrCalc, latestWeight, maintenanceKcal } from "@/lib/calc";
import { KCAL_PER_KG, COLDSTART_FACTOR, n, daysBetween, todayStr, shiftDate, fmtDate } from "@/lib/format";
import { demoDB, defaultDB } from "@/lib/seed";
import { Num, Field, Modal, inputCls } from "@/components/ui";

type Mutate = (fn: (prev: DB) => DB) => void;

interface ProfileForm {
  sex: Sex;
  age: string;
  heightCm: string;
  goalWeight: string;
  targetDate: string;
}

export function SettingsModal({
  db,
  mutate,
  onClose,
}: {
  db: DB;
  mutate: Mutate;
  onClose: () => void;
}) {
  const p = db.profile;
  const [f, setF] = useState<ProfileForm>({
    sex: p?.sex ?? "male",
    age: p ? String(p.age) : "",
    heightCm: p ? String(p.heightCm) : "",
    goalWeight: p ? String(p.goalWeight) : "",
    targetDate: p?.targetDate ?? "",
  });
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
    let def = 0;
    let unreal = false;
    const future = days == null || days > 0;
    if (days && days > 0 && kg > 0) {
      def = (kg * KCAL_PER_KG) / days;
      if (def > maxDef) {
        unreal = true;
        def = maxDef;
      }
    }
    const target = Math.round(Math.max(maint - def, bmr));
    const minDays = kg > 0 && maxDef > 0 ? Math.ceil((kg * KCAL_PER_KG) / maxDef) : null;
    const pro = Math.round(lw * 2.0);
    const fat = Math.round((target * 0.25) / 9);
    const carb = Math.max(0, Math.round((target - pro * 4 - fat * 9) / 4));
    return {
      bmr,
      maint,
      source: m ? m.source : ("estimate" as const),
      target,
      def: Math.round(def),
      pro,
      fat,
      carb,
      unreal,
      minDays,
      days,
      future,
      kg,
    };
  }, [f, lw, m]);

  const valid = f.age !== "" && f.heightCm !== "" && f.goalWeight !== "";
  return (
    <Modal title="プロフィール・目標設定" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="性別">
          <select
            className={inputCls}
            value={f.sex}
            onChange={(e) => setF({ ...f, sex: e.target.value as Sex })}
          >
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </Field>
        <Field label="年齢">
          <input
            className={inputCls}
            type="number"
            value={f.age}
            onChange={(e) => setF({ ...f, age: e.target.value })}
          />
        </Field>
        <Field label="身長(cm)">
          <input
            className={inputCls}
            type="number"
            value={f.heightCm}
            onChange={(e) => setF({ ...f, heightCm: e.target.value })}
          />
        </Field>
        <Field label="目標体重(kg)">
          <input
            className={inputCls}
            type="number"
            step="0.1"
            value={f.goalWeight}
            onChange={(e) => setF({ ...f, goalWeight: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-2">
        <Field label="目標期日（いつまでに）" hint="ここから痩せるペースと1日の目標を自動計算">
          <input
            className={inputCls}
            type="date"
            min={tomorrow}
            value={f.targetDate}
            onChange={(e) => setF({ ...f, targetDate: e.target.value })}
          />
        </Field>
      </div>

      {preview && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Target size={14} />
            自動算出
          </div>
          <div className="mt-2 space-y-1 text-xs text-emerald-900/90">
            <div className="flex justify-between">
              <span>維持カロリー{preview.source === "estimate" ? "（初期推定）" : "（実測平均）"}</span>
              <Num className="font-semibold">{preview.maint.toLocaleString()} kcal</Num>
            </div>
            {preview.days && preview.days > 0 && preview.kg > 0 && (
              <div className="flex justify-between">
                <span>1日の赤字（ペース）</span>
                <Num className="font-semibold">−{preview.def.toLocaleString()} kcal</Num>
              </div>
            )}
            <div className="flex justify-between border-t border-emerald-200/70 pt-1">
              <span className="font-semibold">目標カロリー</span>
              <Num className="font-bold text-emerald-700">{preview.target.toLocaleString()} kcal</Num>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            {(
              [
                ["P", preview.pro],
                ["F", preview.fat],
                ["C", preview.carb],
              ] as [string, number][]
            ).map(([l, v]) => (
              <div key={l}>
                <div className="text-[10px] text-emerald-600">{l}</div>
                <Num className="text-sm font-bold text-emerald-800">{v}g</Num>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-emerald-600/80">
            基礎代謝 {preview.bmr.toLocaleString()}kcal / タンパク質は体重×2g目安
          </p>
        </div>
      )}

      {preview && preview.days != null && preview.days <= 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          目標期日は未来の日付を選んでください。
        </p>
      )}
      {preview && preview.unreal && preview.minDays && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
          このペースは速すぎます（目標が基礎代謝を下回るため下限で調整中）。現実的な最短は約{preview.minDays}日後、
          <span className="font-semibold"> {fmtDate(shiftDate(todayStr(), preview.minDays)).slice(0, -3)}頃</span>
          です。
        </p>
      )}

      <button
        disabled={!valid}
        onClick={() => {
          mutate((d) => ({
            ...d,
            profile: {
              sex: f.sex,
              age: n(f.age),
              heightCm: n(f.heightCm),
              goalWeight: n(f.goalWeight),
              targetDate: f.targetDate || null,
            },
          }));
          onClose();
        }}
        className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white"
      >
        保存
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            if (confirm("デモデータで上書きします。よろしいですか？")) {
              mutate(() => demoDB());
              onClose();
            }
          }}
          className="rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
        >
          デモを再読み込み
        </button>
        <button
          onClick={() => {
            if (confirm("すべての記録を削除します。よろしいですか？")) {
              mutate(() => defaultDB());
              onClose();
            }
          }}
          className="rounded-xl border border-rose-200 py-2.5 text-xs font-semibold text-rose-500"
        >
          データを初期化
        </button>
      </div>
    </Modal>
  );
}
