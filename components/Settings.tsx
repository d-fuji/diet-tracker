"use client";

// 設定: プロフィール（性別/年齢/身長/目標体重/目標期日）＋自動算出プレビュー＋デモ/初期化。
import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import type { DB, Sex, ActivityLevel } from "@/types";
import { bmrCalc, latestWeight, maintenanceKcal } from "@/lib/calc";
import { KCAL_PER_KG, neatFactor, ACTIVITY_LEVELS, n, daysBetween, todayStr, shiftDate, fmtDate } from "@/lib/format";
import { demoDB, defaultDB } from "@/lib/seed";
import { Num, Field, Modal, Button, Input, Select } from "@/components/ui";

type Mutate = (fn: (prev: DB) => DB) => void;

interface ProfileForm {
  sex: Sex;
  age: string;
  heightCm: string;
  goalWeight: string;
  targetDate: string;
  activityLevel: ActivityLevel;
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
    activityLevel: p?.activityLevel ?? "normal",
  });
  const lw = latestWeight(db);
  const tomorrow = shiftDate(todayStr(), 1);

  const preview = useMemo(() => {
    if (!lw || f.age === "" || f.heightCm === "" || f.goalWeight === "") return null;
    const bmr = bmrCalc(f.sex, n(f.age), n(f.heightCm), lw);
    // フォームの内容（活動量含む）を即時プレビューに反映するため、編集中のプロフィールで再計算する。
    const m = maintenanceKcal({
      ...db,
      profile: {
        sex: f.sex,
        age: n(f.age),
        heightCm: n(f.heightCm),
        goalWeight: n(f.goalWeight),
        targetDate: f.targetDate || null,
        activityLevel: f.activityLevel,
      },
    });
    const maint = m ? m.kcal : Math.round(bmr * neatFactor(f.activityLevel));
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
  }, [f, lw, db]);

  const valid = f.age !== "" && f.heightCm !== "" && f.goalWeight !== "";
  return (
    <Modal title="プロフィール・目標設定" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="性別">
          <Select
            aria-label="性別"
            value={f.sex}
            onChange={(v) => setF({ ...f, sex: v as Sex })}
            options={[
              { value: "male", label: "男性" },
              { value: "female", label: "女性" },
            ]}
          />
        </Field>
        <Field label="年齢">
          <Input
            type="number"
            value={f.age}
            onChange={(e) => setF({ ...f, age: e.target.value })}
          />
        </Field>
        <Field label="身長(cm)">
          <Input
            type="number"
            value={f.heightCm}
            onChange={(e) => setF({ ...f, heightCm: e.target.value })}
          />
        </Field>
        <Field label="目標体重(kg)">
          <Input
            type="number"
            step="0.1"
            value={f.goalWeight}
            onChange={(e) => setF({ ...f, goalWeight: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-2">
        <Field label="日常の活動量" hint="運動を除いた普段の活動（通勤・家事など）。維持カロリーの推定に使用">
          <Select
            aria-label="日常の活動量"
            value={f.activityLevel}
            onChange={(v) => setF({ ...f, activityLevel: v as ActivityLevel })}
            options={ACTIVITY_LEVELS.map((a) => ({ value: a.id, label: a.label }))}
          />
        </Field>
      </div>
      <div className="mt-2">
        <Field label="目標期日（いつまでに）" hint="ここから痩せるペースと1日の目標を自動計算">
          <Input
            className="min-w-0 appearance-none"
            type="date"
            min={tomorrow}
            value={f.targetDate}
            onChange={(e) => setF({ ...f, targetDate: e.target.value })}
          />
        </Field>
      </div>

      {preview && (
        <div className="mt-3 rounded-xl bg-accent-soft p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
            <Target size={14} />
            自動算出
          </div>
          <div className="mt-2 space-y-1 text-xs text-accent/90">
            <div className="flex justify-between">
              <span>維持カロリー{preview.source === "estimate" ? "（初期推定）" : "（実測平均）"}</span>
              <Num className="font-semibold">{preview.maint.toLocaleString()} kcal</Num>
            </div>
            {preview.days && preview.days > 0 && preview.kg > 0 && (
              <div className="flex justify-between">
                <span>1日の収支（ペース）</span>
                <Num className="font-semibold">−{preview.def.toLocaleString()} kcal</Num>
              </div>
            )}
            <div className="flex justify-between border-t border-accent-soft/70 pt-1">
              <span className="font-semibold">目標カロリー</span>
              <Num className="font-bold text-accent">{preview.target.toLocaleString()} kcal</Num>
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
                <div className="text-[10px] text-accent">{l}</div>
                <Num className="text-sm font-bold text-accent">{v}g</Num>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-accent/80">
            基礎代謝 {preview.bmr.toLocaleString()}kcal ×NEAT{neatFactor(f.activityLevel)} ＋実測活動＋食事の熱産生 / タンパク質は体重×2g目安
          </p>
        </div>
      )}

      {preview && preview.days != null && preview.days <= 0 && (
        <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-[11px] text-warning">
          目標期日は未来の日付を選んでください。
        </p>
      )}
      {preview && preview.unreal && preview.minDays && (
        <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-[11px] leading-relaxed text-warning">
          このペースは速すぎます（目標が基礎代謝を下回るため下限で調整中）。現実的な最短は約{preview.minDays}日後、
          <span className="font-semibold"> {fmtDate(shiftDate(todayStr(), preview.minDays)).slice(0, -3)}頃</span>
          です。
        </p>
      )}

      <Button
        variant="primary"
        fullWidth
        isDisabled={!valid}
        className="mt-4"
        onPress={() => {
          mutate((d) => ({
            ...d,
            profile: {
              sex: f.sex,
              age: n(f.age),
              heightCm: n(f.heightCm),
              goalWeight: n(f.goalWeight),
              targetDate: f.targetDate || null,
              activityLevel: f.activityLevel,
            },
          }));
          onClose();
        }}
      >
        保存
      </Button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          fullWidth
          onPress={() => {
            if (confirm("デモデータで上書きします。よろしいですか？")) {
              mutate(() => demoDB());
              onClose();
            }
          }}
        >
          デモを再読み込み
        </Button>
        <Button
          variant="danger-soft"
          fullWidth
          onPress={() => {
            if (confirm("すべての記録を削除します。よろしいですか？")) {
              mutate(() => defaultDB());
              onClose();
            }
          }}
        >
          データを初期化
        </Button>
      </div>
    </Modal>
  );
}
