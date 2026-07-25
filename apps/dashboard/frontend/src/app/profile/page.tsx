/**
 * Profile Page component.
 */
export default function ProfilePage() {
  return (
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-2xl text-[var(--primary-main)]">person</span>
        <h1 className="text-2xl font-bold text-[var(--text-main)]">User Profile</h1>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Manage your platform profile and access credentials.
      </p>
    </div>
  );
}
