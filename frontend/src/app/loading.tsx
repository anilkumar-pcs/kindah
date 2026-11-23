export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-2xl space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-kindly-border"
    >
      <p className="text-sm font-medium text-kindly-muted">Loading…</p>
      <div className="h-8 w-2/3 rounded-lg bg-kindly-accent-soft" />
      <div className="h-4 w-full rounded bg-kindly-accent-soft" />
      <div className="h-4 w-5/6 rounded bg-kindly-accent-soft" />
    </div>
  );
}
