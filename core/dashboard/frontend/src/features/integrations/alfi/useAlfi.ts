import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveHousehold } from '@alfheim/shared';
import { useUserCapabilities } from '@/features/dashboard/queries';
import { checkModelBlock, fetchHouseholdModelBlock, fetchModelBlocks, saveHouseholdModelBlock } from './alfiApi';
import type { HouseholdModelBlockUpdate, ModelBlock } from './types';

const DEFAULT_KEY = 'alfi-household-model-block';
const BLOCKS_KEY = 'alfi-model-blocks';

/** Whether the installation runs chat: true, false, or undefined while the capabilities load. */
export function useChatInstalled(): boolean | undefined {
  const { data } = useUserCapabilities();
  return data ? data.chat === true : undefined;
}

/** The household's default shared model block; only queried when chat is installed. */
export function useHouseholdModelBlock(chatInstalled: boolean | undefined) {
  const { householdId, status } = useActiveHousehold();
  return useQuery<ModelBlock | null>({
    queryKey: [DEFAULT_KEY, householdId],
    queryFn: fetchHouseholdModelBlock,
    enabled: chatInstalled === true && status === 'ready',
  });
}

/**
 * Whether ALFI has a usable model: chat is installed and at least one model block the caller may
 * use passed its last health check. Entry points into ALFI stay hidden until this is true.
 */
export function useAlfiReady(): boolean {
  const chatInstalled = useChatInstalled();
  const { householdId, status } = useActiveHousehold();
  const { data } = useQuery<ModelBlock[]>({
    queryKey: [BLOCKS_KEY, householdId],
    queryFn: fetchModelBlocks,
    enabled: chatInstalled === true && status === 'ready',
  });
  return chatInstalled === true && (data ?? []).some((b) => b.health_status === 'ok');
}

function useInvalidateAlfi() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: [DEFAULT_KEY, householdId] });
    await queryClient.invalidateQueries({ queryKey: [BLOCKS_KEY, householdId] });
  };
}

/** Saves the household's model block, then runs chat's health check so readiness is current. */
export function useSaveHouseholdModelBlock() {
  const invalidate = useInvalidateAlfi();
  return useMutation<ModelBlock, Error, HouseholdModelBlockUpdate>({
    mutationFn: async (update) => {
      const saved = await saveHouseholdModelBlock(update);
      return await checkModelBlock(saved.id);
    },
    onSettled: invalidate,
  });
}

/** Re-runs chat's health check of a model block. */
export function useCheckModelBlock() {
  const invalidate = useInvalidateAlfi();
  return useMutation<ModelBlock, Error, string>({ mutationFn: checkModelBlock, onSettled: invalidate });
}
