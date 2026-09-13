export default function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent"></div>
        <p className="text-sm font-mono tracking-wide text-[var(--text-muted)]">
          Loading...
        </p>
      </div>
    </div>
  );
}
