import { describe, it, expect } from "vitest";
import { buildShareText } from "@/lib/share";

describe("buildShareText", () => {
  const base = { date: "2026-06-30", balance: 320, intake: 1680, burned: 2000 };

  it("赤字（収支>=0）は ✅ と「−」「赤字」で表示", () => {
    const t = buildShareText(base);
    expect(t).toContain("✅ 収支 −320 kcal（赤字）");
    expect(t).toContain("🍽 摂取 1,680 kcal");
    expect(t).toContain("🔥 消費 2,000 kcal");
  });

  it("黒字（収支<0）は ⚠️ と「+」「黒字」で表示", () => {
    const t = buildShareText({ ...base, balance: -150 });
    expect(t).toContain("⚠️ 収支 +150 kcal（黒字）");
  });

  it("日付を fmtDate で曜日付き表示し、ハッシュタグを付ける", () => {
    const t = buildShareText(base);
    expect(t).toContain("📊 6/30(火) の収支ダイエット");
    expect(t.trimEnd().endsWith("#収支ダイエット")).toBe(true);
  });

  it("goal 未指定なら体重・目標行を含めない", () => {
    const t = buildShareText(base);
    expect(t).not.toContain("体重");
    expect(t).not.toContain("目標");
  });

  it("goal 指定（未達成）は現在体重・これまでの成果・残りを表示", () => {
    const t = buildShareText({ ...base, goal: { cur: 72, done: 3.5, toGo: 4, reached: false } });
    expect(t).toContain("⚖️ 体重 72kg（開始から −3.5kg）");
    expect(t).toContain("🎯 目標まで あと4.0kg");
  });

  it("goal 達成済みは達成メッセージ", () => {
    const t = buildShareText({ ...base, goal: { cur: 68, done: 8, toGo: 0, reached: true } });
    expect(t).toContain("🎉 目標達成！");
    expect(t).not.toContain("目標まで");
  });

  it("減量実績が無い（done<=0）場合は「開始から」を付けない", () => {
    const t = buildShareText({ ...base, goal: { cur: 72, done: 0, toGo: 4, reached: false } });
    expect(t).toContain("⚖️ 体重 72kg");
    expect(t).not.toContain("開始から");
  });

  it("大きな数値は桁区切りされる", () => {
    const t = buildShareText({ date: "2026-06-30", balance: 1234, intake: 2500, burned: 3734 });
    expect(t).toContain("−1,234 kcal");
    expect(t).toContain("2,500 kcal");
    expect(t).toContain("3,734 kcal");
  });
});
