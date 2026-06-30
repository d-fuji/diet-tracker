"use client";

import type { ReactNode } from "react";
import { Card as HCard, Modal as HModal } from "@heroui/react";
import { clamp, round } from "@/lib/format";

// HeroUI(v3) の Button をそのまま共有プリミティブとして再エクスポート。
// react-aria ベースのため、押下ハンドラは onClick ではなく onPress を使う。
export { Button } from "@heroui/react";

export const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 text-[15px] tabular-nums outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100";

// HeroUI Card をベースに、これまでのライトな見た目（白地・細枠・薄影）を維持。
// 後ろの className が tailwind-merge で優先されるので既存スタイルはそのまま効く。
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <HCard className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      {children}
    </HCard>
  );
}

export function Num({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{children}</span>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</span>
      {right}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  );
}

// HeroUI Modal の合成APIをラップし、既存の `{title, onClose, children}` インターフェースを維持。
// アクセシビリティ（フォーカストラップ・ESC・aria）とアニメーションは HeroUI 側が担当する。
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <HModal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <HModal.Backdrop>
        <HModal.Container placement="auto" size="md">
          <HModal.Dialog>
            <HModal.Header className="flex items-center justify-between">
              <HModal.Heading className="text-base font-semibold text-slate-900">
                {title}
              </HModal.Heading>
              <HModal.CloseTrigger aria-label="閉じる" />
            </HModal.Header>
            <HModal.Body>{children}</HModal.Body>
          </HModal.Dialog>
        </HModal.Container>
      </HModal.Backdrop>
    </HModal>
  );
}

/** 目標対比のマクロ栄養素バー（P/F/C） */
export function MacroRow({
  label,
  val,
  target,
  fill,
}: {
  label: string;
  val: number;
  target: number;
  fill: string;
}) {
  const pct = target > 0 ? (val / target) * 100 : 0;
  const over = val > target && target > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-xs tabular-nums">
          <span className={`font-semibold ${over ? "text-rose-500" : "text-slate-900"}`}>
            {round(val)}
          </span>
          <span className="text-slate-400"> / {target}g</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${over ? "bg-rose-400" : fill}`}
          style={{ width: `${clamp(pct, 0, 100)}%` }}
        />
      </div>
    </div>
  );
}
