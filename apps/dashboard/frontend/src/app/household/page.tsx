'use client';

import { useState } from 'react';
import { useHouseholds, useCreateInvite, useJoinHousehold } from '@/features/household';
import { InviteCodeResponse } from '@/shared/types';

/**
 * Household Management Page View.
 * Displays household details, member list, and invite code generation / joining workflows.
 */
export default function HouseholdPage() {
  const { data: households, isLoading, isError } = useHouseholds();
  const createInviteMutation = useCreateInvite();
  const joinMutation = useJoinHousehold();

  const [activeInvite, setActiveInvite] = useState<InviteCodeResponse | null>(null);
  const [joinTokenInput, setJoinTokenInput] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  const activeHousehold = households && households.length > 0 ? households[0] : null;

  const handleGenerateInvite = () => {
    if (!activeHousehold) return;

    createInviteMutation.mutate(
      {
        household_id: activeHousehold.id,
        role: 'member',
        ttl_minutes: 60,
        max_uses: 5,
      },
      {
        onSuccess: (data) => {
          setActiveInvite(data);
        },
      }
    );
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinTokenInput.trim()) return;
    setJoinStatus(null);

    joinMutation.mutate(
      { token: joinTokenInput.trim() },
      {
        onSuccess: (household) => {
          setJoinStatus(`Successfully joined household "${household.name}"!`);
          setJoinTokenInput('');
        },
        onError: (err) => {
          setJoinStatus(`Failed to join household: ${err.message}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="col-span-12 p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
        <div className="h-8 w-64 bg-[var(--surface-elevated)] rounded" />
        <div className="h-40 w-full bg-[var(--surface-elevated)] rounded-xl" />
      </div>
    );
  }

  if (isError || !activeHousehold) {
    return (
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h1 className="text-xl font-bold text-[var(--text-main)] mb-2">No Active Household</h1>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          You are not currently enrolled in a household. Join one using an invite code below.
        </p>

        <form onSubmit={handleJoinSubmit} className="flex gap-3 max-w-md">
          <input
            type="text"
            placeholder="Enter invite token (e.g. INV-XXXXXX)"
            value={joinTokenInput}
            onChange={(e) => setJoinTokenInput(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)]"
          />
          <button
            type="submit"
            disabled={joinMutation.isPending}
            className="px-4 py-2 bg-[var(--primary-main)] text-slate-950 font-semibold text-xs rounded-lg hover:bg-[var(--primary-hover)] cursor-pointer"
          >
            Join
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {/* Household Header */}
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono mb-2 border border-[var(--border-accent)]">
            <span className="material-symbols-outlined text-sm">home</span>
            Active Household
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">
            {activeHousehold.name}
          </h1>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
            Slug: {activeHousehold.slug} • Your Role: {activeHousehold.role || 'Member'}
          </p>
        </div>

        <button
          onClick={handleGenerateInvite}
          disabled={createInviteMutation.isPending}
          className="px-4 py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-[0_0_15px_var(--accent-glow)] cursor-pointer flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">qr_code_2</span>
          {createInviteMutation.isPending ? 'Generating...' : 'Generate Invite Code'}
        </button>
      </div>

      {/* Invite Code Generator Output Modal/Card */}
      {activeInvite && (
        <div className="col-span-12 p-5 rounded-xl bg-gradient-to-r from-[var(--surface-card)] to-[var(--surface-elevated)] border border-[var(--primary-main)]/50 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[var(--primary-main)]">
              <span className="material-symbols-outlined">confirmation_number</span>
              <span className="text-xs font-mono font-bold uppercase">Household Invite Generated</span>
            </div>
            <button
              onClick={() => setActiveInvite(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="px-4 py-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--primary-main)] text-lg font-mono font-bold text-[var(--primary-main)] tracking-wider">
              {activeInvite.token}
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono">
              Valid for {activeInvite.max_uses} uses • Expires at{' '}
              {new Date(activeInvite.expires_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Members List Section */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-main)]">Household Members</h2>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {activeHousehold.members?.length || 0} Enrolled
          </span>
        </div>

        <div className="space-y-3">
          {activeHousehold.members?.map((member) => (
            <div
              key={member.user_id}
              className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-bold text-[var(--primary-main)]">
                  {member.user_id.slice(-2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-main)]">User ID: {member.user_id}</div>
                  <div className="text-[var(--text-muted)] text-[10px] font-mono">
                    Joined: {new Date(member.joined_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Join Another Household Form */}
      <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          Join Household
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Enter an invite token received from a household owner.
        </p>

        {joinStatus && (
          <div
            className={`p-3 mb-4 rounded-lg text-xs font-mono ${
              joinMutation.isError
                ? 'bg-red-950/40 border border-red-800/40 text-red-300'
                : 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-300'
            }`}
          >
            {joinStatus}
          </div>
        )}

        <form onSubmit={handleJoinSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1.5">
              Invite Code Token
            </label>
            <input
              type="text"
              placeholder="INV-XXXXXX"
              value={joinTokenInput}
              onChange={(e) => setJoinTokenInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={joinMutation.isPending}
            className="w-full py-2.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-semibold text-[var(--text-main)] transition-all cursor-pointer"
          >
            {joinMutation.isPending ? 'Joining...' : 'Submit Invite Token'}
          </button>
        </form>
      </div>
    </>
  );
}
