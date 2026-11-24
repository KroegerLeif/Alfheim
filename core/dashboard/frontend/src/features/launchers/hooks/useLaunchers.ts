import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveHousehold } from '@alfheim/shared';
import { createLauncher, deleteLauncher, fetchLaunchers, updateLauncher } from '../api/launchersApi';
import type { Launcher, LauncherInput } from '../types';

const LAUNCHERS_KEY = 'launchers';

/** Roles that may manage launchers; the backend enforces the same set. */
const MANAGER_ROLES = ['OWNER', 'ADMIN'];

/** Launchers of the active household, loaded once the household is ready. */
export function useLaunchers() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<Launcher[]>({
    queryKey: [LAUNCHERS_KEY, householdId],
    queryFn: fetchLaunchers,
    enabled: status === 'ready',
  });
}

/**
 * Whether the caller may add, edit and remove launchers. The role comes from the membership
 * API through the household context, never from the token; it only hides UI, the backend decides.
 */
export function useCanManageLaunchers(): boolean {
  const { role, status } = useActiveHousehold();
  return status === 'ready' && !!role && MANAGER_ROLES.includes(role.toUpperCase());
}

function useInvalidateLaunchers() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();
  return () => queryClient.invalidateQueries({ queryKey: [LAUNCHERS_KEY, householdId] });
}

export function useCreateLauncher() {
  const invalidate = useInvalidateLaunchers();
  return useMutation<Launcher, Error, LauncherInput>({ mutationFn: createLauncher, onSuccess: invalidate });
}

export function useUpdateLauncher() {
  const invalidate = useInvalidateLaunchers();
  return useMutation<Launcher, Error, { id: string; input: LauncherInput }>({
    mutationFn: ({ id, input }) => updateLauncher(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteLauncher() {
  const invalidate = useInvalidateLaunchers();
  return useMutation<void, Error, string>({ mutationFn: deleteLauncher, onSuccess: invalidate });
}
