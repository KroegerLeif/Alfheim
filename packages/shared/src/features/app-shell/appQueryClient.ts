import { QueryClient } from '@tanstack/react-query';

/**
 * The TanStack Query client every frontend starts with: no refetch on window focus, one retry
 * and five minutes of freshness, so switching tabs does not refetch every list.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 5 * 60 * 1000,
      },
    },
  });
}
