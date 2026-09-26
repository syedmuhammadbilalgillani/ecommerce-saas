'use client';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-5">
      <h1 className="text-sm font-medium text-red-600 dark:text-red-400">Could not load this page</h1>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
      >
        Try again
      </button>
    </div>
  );
}
