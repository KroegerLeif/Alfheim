import { api } from '@/core/api/client';
import type { Plugin, PluginList, PluginUpdate } from '../types';

/** Every plugin type of this build, merged with the active household's settings. */
export async function fetchPlugins(): Promise<PluginList> {
  const list = await api.get('integrations/plugins').json<PluginList>();
  return { items: list.items ?? [], encryption_available: list.encryption_available };
}

/** Stores the household's settings of one plugin type (OWNER and ADMIN only). */
export async function savePlugin(type: string, update: PluginUpdate): Promise<Plugin> {
  return await api.put(`integrations/plugins/${encodeURIComponent(type)}`, update).json<Plugin>();
}

/** Runs the plugin's connection test; a failed test is a result, not an error. */
export async function testPlugin(type: string): Promise<Plugin> {
  return await api.post(`integrations/plugins/${encodeURIComponent(type)}/test`).json<Plugin>();
}
