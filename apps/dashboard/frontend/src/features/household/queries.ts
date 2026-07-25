import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchHouseholds, createHouseholdInvite, joinHousehold } from '@/shared/api';
import {
  Household,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from '@/shared/types';

export const HOUSEHOLDS_QUERY_KEY = ['households', 'me'];

/**
 * Query hook to fetch households associated with current user via GET /api/v1/households/me.
 */
export function useHouseholds() {
  return useQuery<Household[]>({
    queryKey: HOUSEHOLDS_QUERY_KEY,
    queryFn: fetchHouseholds,
  });
}

/**
 * Mutation hook to create an invite code / token via POST /api/v1/households/invite.
 */
export function useCreateInvite() {
  return useMutation<InviteCodeResponse, Error, CreateInviteRequest>({
    mutationFn: createHouseholdInvite,
  });
}

/**
 * Mutation hook to join a household using an invite token via POST /api/v1/households/join.
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
