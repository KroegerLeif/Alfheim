'use client';

/**
 * Premium loading skeleton for Household Detail view.
 * Prevents Layout Shift (CLS) and matches Obsidian styling.
 */
export function HouseholdDetailSkeleton() {
  return (
    <div className="col-span-12 p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-6">
      {/* Title skeleton */}
      <div className="flex justify-between items-center pb-4 border-b border-[var(--border-subtle)]">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-[var(--surface-elevated)] rounded" />
          <div className="h-8 w-64 bg-[var(--surface-elevated)] rounded-md" />
        </div>
        <div className="h-9 w-28 bg-[var(--surface-elevated)] rounded-lg" />
      </div>

      {/* Map & Address widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between h-56 space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-[var(--surface-elevated)] rounded" />
            <div className="h-4 w-48 bg-[var(--surface-elevated)] rounded" />
            <div className="h-4 w-32 bg-[var(--surface-elevated)] rounded" />
          </div>
          <div className="h-8 w-full bg-[var(--surface-elevated)] rounded-lg" />
        </div>
        <div className="lg:col-span-8 h-56 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]" />
      </div>

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        <div className="lg:col-span-5 h-72 rounded-2xl bg-[var(--surface-elevated)]" />
        <div className="lg:col-span-7 h-72 rounded-2xl bg-[var(--surface-elevated)]" />
      </div>
    </div>
  );
}
