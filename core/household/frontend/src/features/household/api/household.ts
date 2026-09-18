import { api } from '@/core/api/client';
import {
  Household,
  CreateHouseholdRequest,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from '@/shared/types';

export async function fetchHouseholds(): Promise<Household[]> {
  return await api.get('api/v1/households/me').json<Household[]>();
}

export async function fetchHousehold(id: string): Promise<Household> {
  return await api.get(`api/v1/households/${id}`).json<Household>();
}

export async function createHousehold(payload: CreateHouseholdRequest): Promise<Household> {
  const slug = payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-');
  return await api.post('api/v1/households', { json: { name: payload.name, slug } }).json<Household>();
}

export async function createHouseholdInvite(payload: CreateInviteRequest): Promise<InviteCodeResponse> {
  return await api.post('api/v1/households/invite', { json: payload }).json<InviteCodeResponse>();
}

export async function joinHousehold(payload: JoinHouseholdRequest): Promise<Household> {
  return await api.post('api/v1/households/join', { json: payload }).json<Household>();
}

export async function updateHouseholdAddress(
  id: string,
  payload: { street: string; zip: string; city: string; country: string; latitude: number | null; longitude: number | null }
): Promise<any> {
  return await api.put(`api/v1/households/${id}/address`, { json: payload }).json();
}

export async function updateMemberRole(householdId: string, userId: string, role: string): Promise<any> {
  return await api.put(`api/v1/households/${householdId}/members/${userId}/role`, { json: { role } }).json();
}

export async function removeMember(householdId: string, userId: string): Promise<any> {
  return await api.delete(`api/v1/households/${householdId}/members/${userId}`).json();
}
