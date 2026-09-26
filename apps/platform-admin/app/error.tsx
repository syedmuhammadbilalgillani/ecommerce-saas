'use client';

export default function PlatformError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-5">
      <h1 className="text-sm font-medium text-red-400">Could not load this page</h1>
      <p className="text-xs text-zinc-400">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
      >
        Try again
      </button>
    </div>
  );
}
