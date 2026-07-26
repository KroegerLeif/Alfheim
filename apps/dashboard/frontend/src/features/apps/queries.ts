import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAppCatalog, createApp, updateApp } from '@/shared/api';
import { AppCatalogResponse, CreateAppRequest, AppItem } from '@/shared/types';

export const APP_CATALOG_QUERY_KEY = ['apps', 'catalog'];

/**
 * Custom TanStack Query hook to fetch the app catalog from GET /api/v1/apps.
 */
export function useAppCatalog() {
  return useQuery<AppCatalogResponse>({
    queryKey: APP_CATALOG_QUERY_KEY,
    queryFn: fetchAppCatalog,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Custom TanStack Query mutation hook to add a new app via POST /api/v1/apps.
 * Automatically invalidates the app catalog query cache.
 */
export function useCreateApp() {
  const queryClient = useQueryClient();

  return useMutation<AppItem, Error, CreateAppRequest>({
    mutationFn: createApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_CATALOG_QUERY_KEY });
    },
  });
}

/**
 * Custom TanStack Query mutation hook to update an app via PUT /api/v1/apps/{id}.
 * Automatically invalidates the app catalog query cache.
 */
export function useUpdateApp() {
  const queryClient = useQueryClient();

  return useMutation<AppItem, Error, { id: string; payload: Partial<CreateAppRequest> }>({
    mutationFn: ({ id, payload }) => updateApp(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_CATALOG_QUERY_KEY });
    },
  });
}

