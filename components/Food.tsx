"use client";

// 食品DB（UGC）: 検索・タグフィルタ・並び替え・追加/編集/削除。FoodForm は記録画面からも利用。
import { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import type { DB, Food, FoodTag } from "@/types";
import { TAGS, n, uid } from "@/lib/format";
import { Card, Field, Modal, inputCls } from "@/components/ui";

type Mutate = (fn: (prev: DB) => DB) => void;

/** 入力中は数値が空文字になりうるためフォーム専用のゆるい型。 */
export interface FoodDraft {
  id?: string;
  name: string;
  kcal: number | string;
  p: number | string;
  f: number | string;
  c: number | string;
  tags: FoodTag[];
}

export function FoodForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: FoodDraft | null;
  onSave: (food: Food) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<FoodDraft>(
    initial ?? { name: "", kcal: "", p: "", f: "", c: "", tags: [] },
  );
  const toggle = (t: FoodTag) =>
    setF((s) => ({
      ...s,
      tags: s.tags.includes(t) ? s.tags.filter((x) => x !== t) : [...s.tags, t],
    }));
  const valid = f.name && f.kcal !== "" && f.p !== "" && f.f !== "" && f.c !== "";
  return (
    <Modal title={initial?.id ? "食品を編集" : "食品を追加"} onClose={onClose}>
      <Field label="名称（1食分の分量込み）">
        <input
          className={inputCls}
          placeholder="例: サラダチキン 1個"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </Field>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Field label="kcal">
          <input
            className={inputCls}
            type="number"
            value={f.kcal}
            onChange={(e) => setF({ ...f, kcal: e.target.value })}
          />
        </Field>
        <Field label="P(g)">
          <input
            className={inputCls}
            type="number"
            value={f.p}
            onChange={(e) => setF({ ...f, p: e.target.value })}
          />
        </Field>
        <Field label="F(g)">
          <input
            className={inputCls}
            type="number"
            value={f.f}
            onChange={(e) => setF({ ...f, f: e.target.value })}
          />
        </Field>
        <Field label="C(g)">
          <input
            className={inputCls}
            type="number"
            value={f.c}
            onChange={(e) => setF({ ...f, c: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3">
        <span className="text-xs font-medium text-slate-500">タグ</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TAGS.map((t) => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                f.tags.includes(t.id) ? t.cls : "bg-slate-100 text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <button
        disabled={!valid}
        onClick={() => {
          onSave({
            id: f.id || uid(),
            name: f.name,
            kcal: n(f.kcal),
            p: n(f.p),
            f: n(f.f),
            c: n(f.c),
            tags: f.tags,
          });
          onClose();
        }}
        className="mt-4 w-full rounded-xl bg-emerald-600 disabled:opacity-30 py-3 text-sm font-semibold text-white"
      >
        保存
      </button>
    </Modal>
  );
}

type SortKey = "name" | "kcal" | "pratio";
type FilterKey = "all" | FoodTag;

export function FoodScreen({ db, mutate }: { db: DB; mutate: Mutate }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  // undefined = 閉じている / null = 新規追加 / Food = 編集
  const [edit, setEdit] = useState<Food | null | undefined>(undefined);

  const list = useMemo(() => {
    let arr = db.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
    if (filter !== "all") arr = arr.filter((f) => f.tags.includes(filter));
    if (sort === "kcal") arr = [...arr].sort((a, b) => a.kcal - b.kcal);
    else if (sort === "pratio") arr = [...arr].sort((a, b) => b.p / (b.kcal || 1) - a.p / (a.kcal || 1));
    else arr = [...arr].sort((a, b) => a.name.localeCompare(b.name, "ja"));
    return arr;
  }, [db.foods, q, filter, sort]);

  const save = (food: Food) =>
    mutate((d) => {
      const exists = d.foods.some((x) => x.id === food.id);
      return {
        ...d,
        foods: exists ? d.foods.map((x) => (x.id === food.id ? food : x)) : [...d.foods, food],
      };
    });
  const del = (id: string) => mutate((d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }));

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur px-4 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-9 mt-0`}
            placeholder="食品を検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[{ id: "all" as const, label: "すべて" }, ...TAGS].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as FilterKey)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === t.id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">並び替え</span>
          {(
            [
              ["name", "名前"],
              ["kcal", "低kcal順"],
              ["pratio", "高タンパク順"],
            ] as [SortKey, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-md px-2 py-0.5 ${
                sort === k ? "bg-emerald-100 text-emerald-700 font-semibold" : "text-slate-500"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 space-y-2 mt-1">
        {list.map((f) => (
          <Card key={f.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{f.name}</p>
                <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                  {f.kcal}kcal · P{f.p} F{f.f} C{f.c}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {f.tags.map((t) => {
                    const tag = TAGS.find((x) => x.id === t);
                    return tag ? (
                      <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tag.cls}`}>
                        {tag.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEdit(f)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="編集"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => del(f.id)}
                  className="rounded-lg p-1.5 text-slate-300 hover:text-rose-500 hover:bg-slate-100"
                  aria-label="削除"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {list.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">該当なし。右下の＋で追加できます。</p>
        )}
        <p className="pt-1 text-center text-[10px] text-slate-300">
          数値はサンプル/ユーザー登録です。実際の表示を確認のうえ編集してください。
        </p>
      </div>
      <button
        onClick={() => setEdit(null)}
        className="fixed bottom-24 right-5 z-20 flex items-center justify-center rounded-full bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-600/30"
        aria-label="食品を追加"
      >
        <Plus size={22} />
      </button>
      {edit !== undefined && <FoodForm initial={edit} onSave={save} onClose={() => setEdit(undefined)} />}
    </div>
  );
}
