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
} from '../api/household';
import {
  Household,
  CreateHouseholdRequest,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from '@/shared/types';

export const HOUSEHOLDS_QUERY_KEY = ['households', 'me'];
export const HOUSEHOLD_QUERY_KEY = (id: string) => ['household', id];

/**
 * Query hook to fetch households associated with the current user.
 */
export function useHouseholds() {
  return useQuery<Household[]>({
    queryKey: HOUSEHOLDS_QUERY_KEY,
    queryFn: fetchHouseholds,
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
  });
}

/**
 * Mutation hook to create a new household.
 */
export function useCreateHousehold() {
  const queryClient = useQueryClient();

  return useMutation<Household, Error, CreateHouseholdRequest>({
    mutationFn: createHousehold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook to create an invite code / token.
 */
export function useCreateInvite() {
  return useMutation<InviteCodeResponse, Error, CreateInviteRequest>({
    mutationFn: createHouseholdInvite,
  });
}

/**
 * Mutation hook to join a household using an invite token.
 */
export function useJoinHousehold() {
  const queryClient = useQueryClient();

  return useMutation<Household, Error, JoinHouseholdRequest>({
    mutationFn: joinHousehold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook to update a household's address.
 */
export function useUpdateHouseholdAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, payload }: { householdId: string; payload: any }) => {
      if (!householdId) throw new Error("Missing active household selection");
      return updateHouseholdAddress(householdId, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY(variables.householdId) });
    },
  });
}

/**
 * Mutation hook to update a member's role in a household.
 */
export function useUpdateMemberRole(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => {
      if (!householdId) throw new Error("Missing active household selection");
      return updateMemberRole(householdId, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY(householdId) });
    },
  });
}

/**
 * Mutation hook to remove a member from a household.
 */
export function useRemoveMember(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => {
      if (!householdId) throw new Error("Missing active household selection");
      return removeMember(householdId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEHOLDS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY(householdId) });
    },
  });
}
