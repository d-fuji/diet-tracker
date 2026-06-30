"use client";

// 食品DB（UGC）: 検索・タグフィルタ・並び替え・追加/編集/削除。FoodForm は記録画面からも利用。
import { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import type { DB, Food, FoodTag, Mutate } from "@/types";
import { TAGS, n, uid } from "@/lib/format";
import { Card, Field, Modal, Button, Input, Chip } from "@/components/ui";

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
      <div className="flex flex-col gap-3">
        <Field label="名称（1食分の分量込み）">
          <Input
            placeholder="例: サラダチキン 1個"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-4 gap-2">
          <Field label="kcal">
            <Input type="number" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} />
          </Field>
          <Field label="P(g)">
            <Input type="number" value={f.p} onChange={(e) => setF({ ...f, p: e.target.value })} />
          </Field>
          <Field label="F(g)">
            <Input type="number" value={f.f} onChange={(e) => setF({ ...f, f: e.target.value })} />
          </Field>
          <Field label="C(g)">
            <Input type="number" value={f.c} onChange={(e) => setF({ ...f, c: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">タグ</span>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={f.tags.includes(t.id) ? "primary" : "outline"}
                className="rounded-full"
                onPress={() => toggle(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
        <Button
          variant="primary"
          fullWidth
          isDisabled={!valid}
          className="mt-1"
          onPress={() => {
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
        >
          保存
        </Button>
      </div>
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

  const sorts: [SortKey, string][] = [
    ["name", "名前"],
    ["kcal", "低kcal順"],
    ["pratio", "高タンパク順"],
  ];

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-10 space-y-2 bg-slate-50/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="食品を検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[{ id: "all" as const, label: "すべて" }, ...TAGS].map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={filter === t.id ? "primary" : "outline"}
              className="shrink-0 rounded-full"
              onPress={() => setFilter(t.id as FilterKey)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">並び替え</span>
          {sorts.map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant={sort === k ? "secondary" : "ghost"}
              className="rounded-full"
              onPress={() => setSort(k)}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-1 space-y-2 px-4">
        {list.map((f) => (
          <Card key={f.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{f.name}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                  {f.kcal}kcal · P{f.p} F{f.f} C{f.c}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {f.tags.map((t) => {
                    const tag = TAGS.find((x) => x.id === t);
                    return tag ? (
                      <Chip key={t} size="sm" className={tag.cls}>
                        {tag.label}
                      </Chip>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button isIconOnly variant="ghost" size="sm" aria-label="編集" onPress={() => setEdit(f)}>
                  <Pencil size={15} className="text-slate-400" />
                </Button>
                <Button isIconOnly variant="ghost" size="sm" aria-label="削除" onPress={() => del(f.id)}>
                  <Trash2 size={15} className="text-slate-400" />
                </Button>
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
      <Button
        isIconOnly
        variant="primary"
        size="lg"
        aria-label="食品を追加"
        className="fixed bottom-24 right-5 z-20 h-14 w-14 rounded-full shadow-lg shadow-emerald-600/30"
        onPress={() => setEdit(null)}
      >
        <Plus size={22} />
      </Button>
      {edit !== undefined && <FoodForm initial={edit} onSave={save} onClose={() => setEdit(undefined)} />}
    </div>
  );
}
