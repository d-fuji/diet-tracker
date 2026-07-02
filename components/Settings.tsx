"use client";

// 設定: プロフィール（性別/年齢/身長/目標体重/目標期日）＋自動算出プレビュー＋デモ/初期化。
import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import type { DB, Sex, Profile, ActivityLevel } from "@/types";
import { latestWeight, targetPlan } from "@/lib/calc";
import { neatFactor, ACTIVITY_LEVELS } from "@/lib/constants";
import { n, shiftDate, fmtDate } from "@/lib/format";
import { demoDB, defaultDB } from "@/lib/seed";
import { Num, Field, Modal, ConfirmDialog, inputCls } from "@/components/ui";

type Mutate = (fn: (prev: DB) => DB) => void;

interface ProfileForm {
  sex: Sex;
  age: string;
  heightCm: string;
  goalWeight: string;
  targetDate: string;
  activityLevel: ActivityLevel;
}

type ConfirmKind = "demo" | "reset" | null;

export function SettingsModal({
  db,
  mutate,
  today,
  onClose,
}: {
  db: DB;
  mutate: Mutate;
  today: string;
  onClose: () => void;
}) {
  const p = db.profile;
  const [f, setF] = useState<ProfileForm>({
    sex: p?.sex ?? "male",
    age: p ? String(p.age) : "",
    heightCm: p ? String(p.heightCm) : "",
    goalWeight: p ? String(p.goalWeight) : "",
    targetDate: p?.targetDate ?? "",
    activityLevel: p?.activityLevel ?? "normal",
  });
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const lw = latestWeight(db);
  const tomorrow = shiftDate(today, 1);

  const valid = f.age !== "" && f.heightCm !== "" && f.goalWeight !== "";
  const draftProfile: Profile | null = valid
    ? {
        sex: f.sex,
        age: n(f.age),
        heightCm: n(f.heightCm),
        goalWeight: n(f.goalWeight),
        targetDate: f.targetDate || null,
        activityLevel: f.activityLevel,
      }
    : null;

  // プレビューは lib/calc.ts の targetPlan をそのまま使う（式の二重定義をしない）。
  // フォームの内容（活動量含む）を即時反映するため、編集中のプロフィールで再計算する。
  const preview = useMemo(
    () => (draftProfile ? targetPlan({ ...db, profile: draftProfile }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, lw, db],
  );

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
        <Field label="日常の活動量" hint="運動を除いた普段の活動（通勤・家事など）。維持カロリーの推定に使用">
          <select
            className={inputCls}
            value={f.activityLevel}
            onChange={(e) => setF({ ...f, activityLevel: e.target.value as ActivityLevel })}
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-2">
        <Field label="目標期日（いつまでに）" hint="ここから痩せるペースと1日の目標を自動計算">
          <input
            className={`${inputCls} appearance-none min-w-0`}
            type="date"
            min={tomorrow}
            value={f.targetDate}
            onChange={(e) => setF({ ...f, targetDate: e.target.value })}
          />
        </Field>
      </div>

      {valid && !lw && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          維持カロリー・目標カロリーの自動算出には体重の記録が必要です。保存後、記録タブの「体重」で今日の体重を保存してください。
        </p>
      )}

      {preview && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Target size={14} />
            自動算出
          </div>
          <div className="mt-2 space-y-1 text-xs text-emerald-900/90">
            <div className="flex justify-between">
              <span>維持カロリー{preview.source === "estimate" ? "（初期推定）" : "（実測平均）"}</span>
              <Num className="font-semibold">{preview.maintenance.toLocaleString()} kcal</Num>
            </div>
            {preview.hasPlan && (
              <div className="flex justify-between">
                <span>1日の収支（ペース）</span>
                <Num className="font-semibold">−{preview.dailyDeficit.toLocaleString()} kcal</Num>
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
                ["P", preview.p],
                ["F", preview.f],
                ["C", preview.c],
              ] as [string, number][]
            ).map(([l, v]) => (
              <div key={l}>
                <div className="text-[10px] text-emerald-600">{l}</div>
                <Num className="text-sm font-bold text-emerald-800">{v}g</Num>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-emerald-600/80">
            基礎代謝 {preview.bmr.toLocaleString()}kcal ×NEAT{neatFactor(f.activityLevel)} ＋実測活動＋食事の熱産生 / タンパク質は体重×2g目安
          </p>
        </div>
      )}

      {preview && preview.days != null && preview.days <= 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          目標期日は未来の日付を選んでください。
        </p>
      )}
      {preview && preview.unrealistic && preview.minDays && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
          このペースは速すぎます（目標が基礎代謝を下回るため下限で調整中）。現実的な最短は約{preview.minDays}日後、
          <span className="font-semibold"> {fmtDate(shiftDate(today, preview.minDays)).slice(0, -3)}頃</span>
          です。
        </p>
      )}

      <button
        disabled={!valid}
        onClick={() => {
          if (!draftProfile) return;
          mutate((d) => ({ ...d, profile: draftProfile }));
          onClose();
        }}
        className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white"
      >
        保存
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setConfirm("demo")}
          className="rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
        >
          デモデータを読み込む
        </button>
        <button
          onClick={() => setConfirm("reset")}
          className="rounded-xl border border-rose-200 py-2.5 text-xs font-semibold text-rose-500"
        >
          データを初期化
        </button>
      </div>
      {confirm === "demo" && (
        <ConfirmDialog
          title="デモデータを読み込む"
          message="現在の記録をすべてデモデータで上書きします。この操作は取り消せません。よろしいですか？"
          confirmLabel="上書きする"
          onConfirm={() => {
            mutate(() => demoDB());
            onClose();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === "reset" && (
        <ConfirmDialog
          title="データを初期化"
          message="すべての記録（食事・体重・活動・筋トレ・プロフィール）を削除します。この操作は取り消せません。よろしいですか？"
          confirmLabel="初期化する"
          onConfirm={() => {
            mutate(() => defaultDB());
            onClose();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </Modal>
  );
}
