import { describe, it, expect } from "vitest";
import { normalizeSearch, matchesSearch, slotByTime, uid } from "@/lib/format";

describe("normalizeSearch / matchesSearch（日本語検索の正規化）", () => {
  it("ひらがな入力でカタカナ名にヒットする", () => {
    expect(matchesSearch("サラダチキン プレーン 1個", "さらだちきん")).toBe(true);
  });
  it("カタカナ入力でひらがな名にヒットする", () => {
    expect(matchesSearch("ゆで卵 1個", "ユデ卵")).toBe(true);
  });
  it("全角英数・半角カナを吸収する（NFKC）", () => {
    expect(normalizeSearch("ＷＰＣ")).toBe(normalizeSearch("wpc"));
    expect(matchesSearch("プロテイン WPC 1杯", "ｗｐｃ")).toBe(true);
    expect(matchesSearch("プロテイン WPC 1杯", "ﾌﾟﾛﾃｲﾝ")).toBe(true);
  });
  it("大文字小文字と空白を無視する", () => {
    expect(matchesSearch("Greek Yogurt", "greekyogurt")).toBe(true);
  });
  it("無関係な語はヒットしない", () => {
    expect(matchesSearch("サラダチキン", "ようかん")).toBe(false);
  });
});

describe("slotByTime", () => {
  const at = (h: number) => new Date(2026, 6, 1, h, 0, 0);
  it("時間帯でスロットを自動選択する", () => {
    expect(slotByTime(at(7))).toBe("breakfast");
    expect(slotByTime(at(12))).toBe("lunch");
    expect(slotByTime(at(19))).toBe("dinner");
    expect(slotByTime(at(22))).toBe("snack");
  });
});

describe("uid", () => {
  it("フル UUID を返す（切り詰めない）", () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
