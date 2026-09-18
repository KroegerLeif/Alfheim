import { HouseholdRole, HOUSEHOLD_ROLES } from '@/shared/types';

/**
 * What the caller may do in a household, derived from `role` in the
 * household detail response. This only hides/disables UI; the backend
 * enforces the same rules and answers 403 otherwise.
 */
export interface HouseholdPermissions {
  role: HouseholdRole;
  canRename: boolean;
  canDelete: boolean;
  canTransferOwnership: boolean;
  canLeave: boolean;
  canManageInvites: boolean;
  canManageMembers: boolean;
  canEditAddress: boolean;
  canEditContacts: boolean;
  canSetDefault: boolean;
}

export function normalizeRole(role: string | null | undefined): HouseholdRole {
  const upper = (role ?? '').toUpperCase();
  return (HOUSEHOLD_ROLES as readonly string[]).includes(upper) ? (upper as HouseholdRole) : 'GUEST';
}

export function getHouseholdPermissions(role: string | null | undefined): HouseholdPermissions {
  const r = normalizeRole(role);
  const isOwner = r === 'OWNER';
  const isOwnerOrAdmin = isOwner || r === 'ADMIN';
  return {
    role: r,
    canRename: isOwnerOrAdmin,
    canDelete: isOwner,
    canTransferOwnership: isOwner,
    // An owner has to hand over ownership before leaving.
    canLeave: !isOwner,
    canManageInvites: isOwnerOrAdmin,
    canManageMembers: isOwnerOrAdmin,
    canEditAddress: isOwnerOrAdmin,
    canEditContacts: r !== 'GUEST',
    // The default household is a per-user preference; any member may set it.
    canSetDefault: true,
  };
}
