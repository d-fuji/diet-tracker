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
  Meter,
  Tabs as HTabs,
} from "@heroui/react";
import { round } from "@/lib/format";

// HeroUI(v3) のコンポーネントを共有プリミティブとして再エクスポート。
// react-aria ベースなので Button の押下は onClick ではなく onPress を使う。
export {
  Button,
  Chip,
  Separator,
  Spinner,
  Switch,
  Tooltip,
  Heading,
  Typography,
} from "@heroui/react";

// HeroUI Input は fullWidth 既定 false なので、フォーム用途に合わせて全幅を既定化。
export function Input(props: ComponentProps<typeof HInput>) {
  return <HInput fullWidth {...props} />;
}

// HeroUI Card をそのまま使用（独自の枠・影は被せない）。className は余白指定のみ通す。
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <HCard className={className}>{children}</HCard>;
}

export function Num({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{children}</span>;
}

/** カード見出し行（左ラベル＋任意の右スロット）。 */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</span>
      {right}
    </div>
  );
}

/** フォーム1項目: ラベル＋コントロール＋補足。 */
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
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

/** セレクト（選択肢配列で使える薄いラッパー）。 */
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

/** セグメント切替（HeroUI Tabs を選択コントロールとして使う）。パネルは持たず value を制御。 */
export function SegTabs<T extends string>({
  value,
  onChange,
  items,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: ReactNode }[];
  "aria-label"?: string;
}) {
  return (
    <HTabs aria-label={ariaLabel} selectedKey={value} onSelectionChange={(k) => onChange(k as T)}>
      <HTabs.List>
        {items.map((it) => (
          <HTabs.Tab key={it.id} id={it.id}>
            {it.label}
          </HTabs.Tab>
        ))}
      </HTabs.List>
    </HTabs>
  );
}

/** 統計タイル（ラベル＋値）。accent=true で強調（現在値など）。 */
export function Stat({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl py-2.5 text-center ${accent ? "bg-accent-soft" : "bg-default"}`}>
      <div className={`text-[11px] ${accent ? "text-accent/90" : "text-muted"}`}>{label}</div>
      <div className={accent ? "text-accent" : "text-foreground"}>{children}</div>
    </div>
  );
}

// HeroUI Modal の合成APIをラップし、既存の {title, onClose, children} を維持。
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

/** 目標対比のマクロ栄養素バー（P/F/C）。HeroUI Meter で表現。 */
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
  const over = val > target && target > 0;
  return (
    <Meter value={val} maxValue={Math.max(target, 1)} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="text-xs tabular-nums">
          <span className={`font-semibold ${over ? "text-danger" : "text-foreground"}`}>{round(val)}</span>
          <span className="text-muted"> / {target}g</span>
        </span>
      </div>
      <Meter.Track className="h-1.5 overflow-hidden rounded-full bg-default">
        <Meter.Fill className={`h-full rounded-full ${over ? "bg-danger" : fill}`} />
      </Meter.Track>
    </Meter>
  );
}
