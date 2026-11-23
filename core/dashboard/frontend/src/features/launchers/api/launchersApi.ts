import { api } from '@/core/api/client';
import type { Launcher, LauncherInput, LauncherPage } from '../types';

/** The active household's launchers; the client sends X-Household-ID. */
export async function fetchLaunchers(): Promise<Launcher[]> {
  const page = await api.get('launchers').json<LauncherPage>();
  return page.items ?? [];
}

export async function createLauncher(input: LauncherInput): Promise<Launcher> {
  return await api.post('launchers', input).json<Launcher>();
}

export async function updateLauncher(id: string, input: LauncherInput): Promise<Launcher> {
  return await api.put(`launchers/${encodeURIComponent(id)}`, input).json<Launcher>();
}

export async function deleteLauncher(id: string): Promise<void> {
  await api.delete(`launchers/${encodeURIComponent(id)}`);
}
