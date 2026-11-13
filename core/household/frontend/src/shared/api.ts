import { api } from '@/core/api/client';
import { UserProfile, UpdateProfileRequest } from './types';

/* User Profile API */
export async function fetchUserProfile(): Promise<UserProfile> {
  return await api.get('profile/me').json<UserProfile>();
}

export async function updateUserProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  return await api.put('profile/me', payload).json<UserProfile>();
}
