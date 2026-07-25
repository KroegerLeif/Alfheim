/**
 * Household Management Page component.
 */
export default function HouseholdPage() {
  return (
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-2xl text-[var(--primary-main)]">home_app_logo</span>
        <h1 className="text-2xl font-bold text-[var(--text-main)]">Household Overview</h1>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Manage household members, shared resources, and permissions.
      </p>
    </div>
  );
}
