import { useQuery } from '@tanstack/react-query';
import { fetchAppCatalog } from '@/shared/api';
import { AppCatalogResponse } from '@/shared/types';

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
