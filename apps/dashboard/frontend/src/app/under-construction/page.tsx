'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Under Construction fallback page view for applications in progress or undergoing maintenance.
 */
export default function UnderConstructionPage() {
  const searchParams = useSearchParams();
  const appName = searchParams.get('app') || 'Service';

  return (
    <div className="col-span-12 min-h-[70vh] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden shadow-2xl">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary-main)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-16 h-16 rounded-2xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] mb-6 shadow-[0_0_20px_var(--accent-glow)]">
        <span className="material-symbols-outlined text-3xl">construction</span>
      </div>

      <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold tracking-wider uppercase mb-4">
        STATUS: IN PROGRESS
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] mb-3">
        {appName} is Under Construction
      </h1>

      <p className="text-sm text-[var(--text-muted)] max-w-md mb-8 leading-relaxed font-sans">
        The requested microservice or portal is currently being deployed and configured as part of the Loeger OS platform release.
      </p>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-lg cursor-pointer"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
