'use client';

import { useTranslation } from '@alfheim/shared';
import { Household, HouseholdMember } from '@/shared/types';

interface MemberGridProps {
  household: Household;
  isOwnerOrAdmin: boolean;
  onRoleChange: (userId: string, currentRole: string, newRole: string) => void;
  onRemoveMember: (userId: string, displayName: string) => void;
}

/**
 * Renders the roster of members in the household, managing roles and removals.
 */
export function MemberGrid({
  household,
  isOwnerOrAdmin,
  onRoleChange,
  onRemoveMember,
}: MemberGridProps) {
  const { t } = useTranslation();
  const members = household?.members ?? [];

  const getMemberDisplayName = (m: HouseholdMember) => {
    if (m.first_name || m.last_name) {
      return `${m.first_name || ''} ${m.last_name || ''}`.trim();
    }
    if (m.username) return `@${m.username}`;
    if (m.email) return m.email;
    if (m.user_id) {
      return `User (${m.user_id.substring(0, 8)}...)`;
    }
    return t('household.member_user');
  };

  const getMemberInitials = (m: HouseholdMember) => {
    if (m.first_name && m.last_name) {
      return `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
    }
    if (m.username) return m.username.substring(0, 2).toUpperCase();
    if (m.email) return m.email.substring(0, 2).toUpperCase();
    return 'MU';
  };

  return (
    <div className="lg:col-span-5 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <h2 className="text-sm font-mono uppercase tracking-wide text-[var(--text-muted)]">
          {t('household.registry_and_members')}
        </h2>
        <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-canvas)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
          {t('household.enrolled_count', { count: members.length })}
        </span>
      </div>

      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.user_id}
              className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs hover:border-[var(--border-accent)] transition-colors duration-150"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-bold text-[var(--primary-main)] shrink-0 overflow-hidden">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt={getMemberDisplayName(member)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getMemberInitials(member)
                  )}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-main)]">{getMemberDisplayName(member)}</div>
                  <div className="text-[var(--text-muted)] text-[10px] font-mono leading-normal">
                    {member.email ? `${member.email}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isOwnerOrAdmin && member.role !== 'OWNER' && member.user_id !== household.owner_id ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={member.role}
                      onChange={(e) => onRoleChange(member.user_id, member.role, e.target.value)}
                      className="bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="GUEST">GUEST</option>
                    </select>
                    <button
                      onClick={() => onRemoveMember(member.user_id, getMemberDisplayName(member))}
                      className="text-red-400 hover:text-red-300 font-bold cursor-pointer inline-flex items-center p-0.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded hover:border-red-400/40"
                    >
                      <span className="material-symbols-outlined text-sm">person_remove</span>
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
                    {member.role}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
            {t('household.no_members')}
          </div>
        )}
      </div>
    </div>
  );
}
