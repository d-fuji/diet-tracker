// 今日のサマリーを SNS/友達に共有するためのテキスト生成（純関数）とランタイムヘルパー。
// 文面生成は副作用なしで testable に保ち、共有処理（Web Share / クリップボード）だけ分離する。
import { fmtDate, round } from "@/lib/format";

export interface ShareGoal {
  cur: number; // 現在体重 kg
  done: number; // 開始からの減量 kg（>=0）
  toGo: number; // 目標まで kg（>=0）
  reached: boolean; // 目標達成済みか
}

export interface ShareInput {
  date: string; // "YYYY-MM-DD"
  balance: number; // 収支 = 消費 − 摂取（>=0 で消費超）
  intake: number; // 摂取 kcal
  burned: number; // 消費 kcal
  goal?: ShareGoal | null; // 体重・目標進捗（プロフィール/体重未登録なら null）
}

/** 共有用のサマリー文面を組み立てる。煽らない中立トーン（HANDOFF §6-7）。 */
export function buildShareText({ date, balance, intake, burned, goal }: ShareInput): string {
  // 収支は符号（−=消費超／+=摂取超）で表す。赤字/黒字は家計簿の意味と逆で紛らわしいため使わない。
  const sign = balance >= 0 ? "−" : "+";
  const lines = [
    `📊 ${fmtDate(date)} のカロリー収支`,
    "",
    `収支 ${sign}${Math.abs(round(balance)).toLocaleString()} kcal`,
    `🍽 摂取 ${round(intake).toLocaleString()} kcal`,
    `🔥 消費 ${round(burned).toLocaleString()} kcal`,
  ];
  if (goal) {
    lines.push("");
    const doneStr = goal.done > 0 ? `（開始から −${goal.done.toFixed(1)}kg）` : "";
    lines.push(`⚖️ 体重 ${goal.cur}kg${doneStr}`);
    lines.push(goal.reached ? "🎉 目標達成！" : `🎯 目標まで あと${goal.toGo.toFixed(1)}kg`);
  }
  lines.push("", "#収支ダイエット");
  return lines.join("\n");
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * 共有を実行する。Web Share API があれば OS のシェアシートを開き、
 * 無ければクリップボードへコピーしてフォールバックする。
 * ユーザーが共有をキャンセルした場合は "cancelled"（フィードバック不要）。
 */
export async function shareSummary(text: string, title = "収支ダイエット"): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // それ以外（権限不可など）はクリップボードへフォールバック
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
