"use client";

// ルートのエラーバウンダリ。描画中の例外で白画面にせず、再試行の導線を出す。
// データは IndexedDB にあるため、リロードで失われることはない。
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-semibold text-slate-800">画面の表示中に問題が発生しました</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        記録データは端末内に保存されています。再試行しても直らない場合はアプリを開き直してください。
      </p>
      {error.digest && <p className="mt-1 text-[10px] text-slate-300 tabular-nums">ref: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
      >
        再試行
      </button>
    </div>
  );
}
