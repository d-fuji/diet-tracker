// 日付・数値・文字列の純粋ヘルパー。ドメイン定数は lib/constants.ts に置く。
import type { Slot, Meal } from "@/types";
import { SLOTS } from "@/lib/constants";

/** 衝突しにくい ID（UUID v4）。レンダリング中ではなくイベント時/マウント後に呼ぶ前提。 */
export const uid = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const shiftDate = (s: string, n: number): string => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export const fmtDate = (s: string): string => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const w = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${m}/${d}(${w})`;
};

export const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};

export const n = (v: string | number): number => (Number.isFinite(+v) ? +v : 0);
export const round = (v: number): number => Math.round(v);
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** 「サラダチキン 1個」→「サラダチキン」。チップの省スペース表示用。 */
export const shortName = (s: string): string => s.replace(/\s?\d+(個|本|杯|枚|g)$/, "");

/**
 * 食品検索用の正規化。大小文字・全角半角（NFKC）を吸収し、カタカナはひらがなに寄せる。
 * 「さらだちきん」→「サラダチキン」がヒットするように、query と対象名の両方に適用する。
 */
export const normalizeSearch = (s: string): string =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");

/** 正規化つき部分一致。 */
export const matchesSearch = (name: string, query: string): boolean =>
  normalizeSearch(name).includes(normalizeSearch(query));

export const slotByTime = (now: Date = new Date()): Slot => {
  const h = now.getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
};

export const mealSlot = (m: Meal): Slot => (SLOTS.includes(m.slot) ? m.slot : "snack");
