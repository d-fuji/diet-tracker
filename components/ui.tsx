"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { clamp, round } from "@/lib/format";

// text-base(16px) 必須: iOS Safari は 16px 未満の input にフォーカスすると自動ズームする。
export const inputCls =
  "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 text-base tabular-nums outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white border border-slate-200/80 shadow-sm ${className}`}>
      {children}
    </div>
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    panel?.focus();

    // 背面スクロールを固定（ボトムシートの裏でページが動かないように）。
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // 簡易フォーカストラップ: Tab をモーダル内で循環させる。
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 text-slate-500"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 破壊的操作の確認ダイアログ。window.confirm の代替（見た目・a11yを統一）。 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "削除",
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
        >
          キャンセル
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-xl py-2.5 text-sm font-semibold text-white ${
            danger ? "bg-rose-500" : "bg-emerald-600"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
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
