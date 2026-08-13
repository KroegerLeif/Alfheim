import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserProfile, updateUserProfile } from '@/shared/api';
import { UserProfile, UpdateProfileRequest } from '@/shared/types';

export const USER_PROFILE_QUERY_KEY = ['profile', 'me'];

/**
 * Query hook to fetch current user profile from GET /api/v1/profile/me.
 */
export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: fetchUserProfile,
  });
}

/**
 * Mutation hook to update current user profile via PUT /api/v1/profile/me.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<UserProfile, Error, UpdateProfileRequest>({
    mutationFn: updateUserProfile,
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(USER_PROFILE_QUERY_KEY, updatedProfile);
    },
  });
}
