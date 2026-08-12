import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDashboardApps,
  fetchUserPreferences,
  updateUserPreferences,
  createUserLink,
  updateUserLink,
  deleteUserLink,
} from '@/shared/api';
import {
  DashboardAppsResponse,
  UserPreferences,
  CreateUserLinkRequest,
  AppItem,
} from '@/shared/types';

export const DASHBOARD_APPS_QUERY_KEY = ['apps', 'dashboard'];
export const USER_PREFERENCES_QUERY_KEY = ['user', 'preferences'];

/**
 * Custom TanStack Query hook to fetch 3-tier dashboard apps from GET /api/v1/apps/dashboard.
 */
export function useDashboardApps() {
  return useQuery<DashboardAppsResponse>({
    queryKey: DASHBOARD_APPS_QUERY_KEY,
    queryFn: fetchDashboardApps,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Custom TanStack Query hook to fetch user preferences from GET /api/v1/user/preferences.
 */
export function useUserPreferences() {
  return useQuery<UserPreferences>({
    queryKey: USER_PREFERENCES_QUERY_KEY,
    queryFn: fetchUserPreferences,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Custom TanStack Query mutation hook to update hidden Core Apps preferences.
 */
export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation<UserPreferences, Error, string[]>({
    mutationFn: updateUserPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_APPS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: USER_PREFERENCES_QUERY_KEY });
    },
  });
}

/**
 * Custom TanStack Query mutation hook to create a Tier 3 User Link.
 */
export function useCreateUserLink() {
  const queryClient = useQueryClient();

  return useMutation<AppItem, Error, CreateUserLinkRequest>({
    mutationFn: createUserLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_APPS_QUERY_KEY });
    },
  });
}

/**
 * Custom TanStack Query mutation hook to update a Tier 3 User Link.
 */
export function useUpdateUserLink() {
  const queryClient = useQueryClient();

  return useMutation<AppItem, Error, { id: string; payload: Partial<CreateUserLinkRequest> }>({
    mutationFn: ({ id, payload }) => updateUserLink(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_APPS_QUERY_KEY });
    },
  });
}

/**
 * Custom TanStack Query mutation hook to delete a Tier 3 User Link.
 */
export function useDeleteUserLink() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteUserLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_APPS_QUERY_KEY });
    },
  });
}

/* Backward-compatibility hook alias */
export const useAppCatalog = useDashboardApps;
export const useCreateApp = useCreateUserLink;
export const useUpdateApp = useUpdateUserLink;
