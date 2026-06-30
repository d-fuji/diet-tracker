"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Card as HCard,
  Modal as HModal,
  Select as HSelect,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Input as HInput,
} from "@heroui/react";
import { clamp, round } from "@/lib/format";

// HeroUI(v3) の Button を共有プリミティブとして再エクスポート。
// react-aria ベースのため、押下ハンドラは onClick ではなく onPress を使う。
export { Button } from "@heroui/react";

// HeroUI Input は fullWidth 既定 false（基底クラスに幅指定なし）。フォームは
// セル幅いっぱいに伸ばしたいので fullWidth を既定にする。呼び出し側で上書き可能。
export function Input(props: ComponentProps<typeof HInput>) {
  return <HInput fullWidth {...props} />;
}

// HeroUI Card をそのまま使用（独自の背景・枠・影は被せない）。className は余白などの
// レイアウト指定のみを通す。
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <HCard className={className}>{children}</HCard>;
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
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/** HeroUI Select の合成APIを束ねた、選択肢配列で使える薄いラッパー。 */
export function Select({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  "aria-label"?: string;
}) {
  return (
    <HSelect
      fullWidth
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k))}
    >
      <SelectTrigger>
        <SelectValue />
        <SelectIndicator />
      </SelectTrigger>
      <SelectPopover>
        <ListBox>
          {options.map((o) => (
            <ListBoxItem key={o.value} id={o.value}>
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </SelectPopover>
    </HSelect>
  );
}

// HeroUI Modal の合成APIをラップし、既存の `{title, onClose, children}` を維持。
// 見た目・アクセシビリティ（フォーカストラップ・ESC・aria）は HeroUI 標準に委ねる。
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
            <HModal.Header>
              <HModal.Heading>{title}</HModal.Heading>
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
