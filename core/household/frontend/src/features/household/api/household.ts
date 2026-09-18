import { api } from '@/core/api/client';
import {
  Household,
  CreateHouseholdRequest,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
} from '@/shared/types';

const hh = (id: string) => `api/v1/households/${encodeURIComponent(id)}`;

export async function fetchHouseholds(): Promise<Household[]> {
  const data = await api.get('api/v1/households/me').json<Household[] | null>();
  return Array.isArray(data) ? data : [];
}

export async function fetchHousehold(id: string): Promise<Household> {
  return await api.get(hh(id)).json<Household>();
}

export async function createHousehold(payload: CreateHouseholdRequest): Promise<Household> {
  const slug = payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-');
  return await api.post('api/v1/households', { json: { name: payload.name, slug } }).json<Household>();
}

export async function renameHousehold(id: string, name: string): Promise<Household> {
  return await api.patch(hh(id), { json: { name } }).json<Household>();
}

export async function deleteHousehold(id: string): Promise<void> {
  await api.delete(hh(id));
}

export async function transferOwnership(id: string, userId: string): Promise<void> {
  await api.post(`${hh(id)}/transfer-ownership`, { json: { user_id: userId } });
}

export async function leaveHousehold(id: string): Promise<void> {
  await api.post(`${hh(id)}/leave`);
}

export async function setDefaultHousehold(id: string): Promise<void> {
  await api.put(`${hh(id)}/default`);
}

export async function createHouseholdInvite(payload: CreateInviteRequest): Promise<InviteCodeResponse> {
  return await api.post('api/v1/households/invite', { json: payload }).json<InviteCodeResponse>();
}

export async function fetchHouseholdInvites(id: string): Promise<InviteCodeResponse[]> {
  const data = await api.get(`${hh(id)}/invites`).json<InviteCodeResponse[] | null>();
  return Array.isArray(data) ? data : [];
}

export async function revokeHouseholdInvite(id: string, token: string): Promise<void> {
  await api.delete(`${hh(id)}/invites/${encodeURIComponent(token)}`);
}

export async function joinHousehold(payload: JoinHouseholdRequest): Promise<Household> {
  return await api.post('api/v1/households/join', { json: payload }).json<Household>();
}

export interface UpdateAddressPayload {
  street: string;
  zip: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export async function updateHouseholdAddress(id: string, payload: UpdateAddressPayload): Promise<unknown> {
  return await api.put(`${hh(id)}/address`, { json: payload }).json();
}

export async function updateMemberRole(householdId: string, userId: string, role: string): Promise<unknown> {
  return await api.put(`${hh(householdId)}/members/${encodeURIComponent(userId)}/role`, { json: { role } }).json();
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  await api.delete(`${hh(householdId)}/members/${encodeURIComponent(userId)}`);
}
