export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="kindly-card mx-auto max-w-2xl space-y-4 p-6"
    >
      <p className="text-sm text-kindly-muted">Loading…</p>
      <div className="h-8 w-2/3 rounded-lg bg-kindly-accent-soft" />
      <div className="h-4 w-full rounded bg-kindly-accent-soft" />
      <div className="h-4 w-5/6 rounded bg-kindly-accent-soft" />
    </div>
  );
}
