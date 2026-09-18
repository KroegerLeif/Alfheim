import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchHouseholds,
  fetchHousehold,
  createHousehold,
  createHouseholdInvite,
  joinHousehold,
  updateHouseholdAddress,
  updateMemberRole,
  removeMember,
  renameHousehold,
  deleteHousehold,
  transferOwnership,
  leaveHousehold,
  setDefaultHousehold,
  fetchHouseholdInvites,
  revokeHouseholdInvite,
  UpdateAddressPayload,
} from '../api/household';
import {
  Household,
  CreateHouseholdRequest,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from '@/shared/types';
import { getErrorStatus } from '@/lib/apiErrors';

export const HOUSEHOLDS_QUERY_KEY = ['households', 'me'];
export const HOUSEHOLD_QUERY_KEY = (id: string) => ['household', id];
export const HOUSEHOLD_INVITES_QUERY_KEY = (id: string) => ['household', id, 'invites'];

/** Don't retry client errors (403/404 …): they won't fix themselves. */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

/**
 * Query hook to fetch households associated with the current user.
 */
export function useHouseholds() {
  return useQuery<Household[], Error>({
    queryKey: HOUSEHOLDS_QUERY_KEY,
    queryFn: fetchHouseholds,
    retry: retryUnlessClientError,
  });
}

/**
 * Query hook to fetch details of a single household by ID.
 */
export function useHousehold(id: string) {
  return useQuery<Household, Error>({
    queryKey: HOUSEHOLD_QUERY_KEY(id),
    queryFn: () => fetchHousehold(id),
    enabled: !!id,
    retry: retryUnlessClientError,
  });
}

/**
 * Query hook listing a household's active invites (OWNER/ADMIN only).
 */
export function useHouseholdInvites(id: string, enabled = true) {
  return useQuery<InviteCodeResponse[], Error>({
    queryKey: HOUSEHOLD_INVITES_QUERY_KEY(id),
    queryFn: () => fetchHouseholdInvites(id),
    enabled: !!id && enabled,
    retry: retryUnlessClientError,
  });
}

function useInvalidateHousehold() {
  const queryClient = useQueryClient();
  return (householdId?: string) => {
    queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
    if (householdId) {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY(householdId) });
    }
  };
}

/**
 * Mutation hook to create a new household.
 */
export function useCreateHousehold() {
  const invalidate = useInvalidateHousehold();
  return useMutation<Household, Error, CreateHouseholdRequest>({
    mutationFn: createHousehold,
    onSuccess: () => invalidate(),
  });
}

/**
 * Mutation hook to create an invite code / token.
 */
export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation<InviteCodeResponse, Error, CreateInviteRequest>({
    mutationFn: createHouseholdInvite,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLD_INVITES_QUERY_KEY(variables.household_id) });
    },
  });
}

/**
 * Mutation hook to revoke an invite by token.
 */
export function useRevokeInvite(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (token) => revokeHouseholdInvite(householdId, token),
    onSuccess: (_, token) => {
      queryClient.setQueryData<InviteCodeResponse[]>(
        HOUSEHOLD_INVITES_QUERY_KEY(householdId),
        (prev) => prev?.filter((inv) => inv.token !== token),
      );
      queryClient.invalidateQueries({ queryKey: HOUSEHOLD_INVITES_QUERY_KEY(householdId) });
    },
  });
}

/**
 * Mutation hook to join a household using an invite token.
 */
export function useJoinHousehold() {
  const invalidate = useInvalidateHousehold();
  return useMutation<Household, Error, JoinHouseholdRequest>({
    mutationFn: joinHousehold,
    onSuccess: (household) => invalidate(household?.id),
  });
}

/**
 * Mutation hook to rename a household.
 */
export function useRenameHousehold(householdId: string) {
  const invalidate = useInvalidateHousehold();
  return useMutation<Household, Error, string>({
    mutationFn: (name) => renameHousehold(householdId, name),
    onSuccess: () => invalidate(householdId),
  });
}

/**
 * Mutation hook to delete a household (OWNER only).
 */
export function useDeleteHousehold(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => deleteHousehold(householdId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_QUERY_KEY(householdId) });
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook to transfer ownership to another member (OWNER only).
 */
export function useTransferOwnership(householdId: string) {
  const invalidate = useInvalidateHousehold();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => transferOwnership(householdId, userId),
    onSuccess: () => invalidate(householdId),
  });
}

/**
 * Mutation hook for the caller to leave a household.
 */
export function useLeaveHousehold(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => leaveHousehold(householdId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: HOUSEHOLD_QUERY_KEY(householdId) });
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook to mark a household as the caller's default.
 */
export function useSetDefaultHousehold() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: setDefaultHousehold,
    onSuccess: (_, householdId) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_QUERY_KEY, (prev) =>
        prev?.map((h) => ({ ...h, is_default: h.id === householdId })),
      );
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook to update a household's address.
 */
export function useUpdateHouseholdAddress() {
  const invalidate = useInvalidateHousehold();
  return useMutation<unknown, Error, { householdId: string; payload: UpdateAddressPayload }>({
    mutationFn: ({ householdId, payload }) => {
      if (!householdId) throw new Error('Missing active household selection');
      return updateHouseholdAddress(householdId, payload);
    },
    onSuccess: (_, variables) => invalidate(variables.householdId),
  });
}

/**
 * Mutation hook to update a member's role in a household.
 */
export function useUpdateMemberRole(householdId: string) {
  const invalidate = useInvalidateHousehold();
  return useMutation<unknown, Error, { userId: string; role: string }>({
    mutationFn: ({ userId, role }) => {
      if (!householdId) throw new Error('Missing active household selection');
      return updateMemberRole(householdId, userId, role);
    },
    onSuccess: () => invalidate(householdId),
  });
}

/**
 * Mutation hook to remove a member from a household.
 */
export function useRemoveMember(householdId: string) {
  const invalidate = useInvalidateHousehold();
  return useMutation<void, Error, string>({
    mutationFn: (userId) => {
      if (!householdId) throw new Error('Missing active household selection');
      return removeMember(householdId, userId);
    },
    onSuccess: () => invalidate(householdId),
  });
}
