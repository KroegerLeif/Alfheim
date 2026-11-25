import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveHousehold } from '@alfheim/shared';
import { fetchPlugins, savePlugin, testPlugin } from '../api/pluginsApi';
import type { Plugin, PluginList, PluginUpdate } from '../types';

const PLUGINS_KEY = 'integration-plugins';

/** Roles that may change and test plugins; the backend enforces the same set. */
const MANAGER_ROLES = ['OWNER', 'ADMIN'];

/** Plugins of the active household, loaded once the household is ready. */
export function usePlugins() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<PluginList>({
    queryKey: [PLUGINS_KEY, householdId],
    queryFn: fetchPlugins,
    enabled: status === 'ready',
  });
}

/**
 * Whether the caller may change and test plugins. The role comes from the membership API through
 * the household context, never from the token; it only hides UI, the backend decides.
 */
export function useCanManagePlugins(): boolean {
  const { role, status } = useActiveHousehold();
  return status === 'ready' && !!role && MANAGER_ROLES.includes(role.toUpperCase());
}

function useInvalidatePlugins() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();
  return () => queryClient.invalidateQueries({ queryKey: [PLUGINS_KEY, householdId] });
}

/** Saves one plugin's settings and reloads the list. */
export function useSavePlugin() {
  const invalidate = useInvalidatePlugins();
  return useMutation<Plugin, Error, { type: string; update: PluginUpdate }>({
    mutationFn: ({ type, update }) => savePlugin(type, update),
    onSuccess: invalidate,
  });
}

/** Tests one plugin's connection and reloads the list with the stored result. */
export function useTestPlugin() {
  const invalidate = useInvalidatePlugins();
  return useMutation<Plugin, Error, string>({ mutationFn: testPlugin, onSuccess: invalidate });
}
