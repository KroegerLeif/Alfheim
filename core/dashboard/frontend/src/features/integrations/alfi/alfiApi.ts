import { isApiError } from '@alfheim/shared';
import { api } from '@/core/api/client';
import type { HouseholdModelBlockUpdate, ModelBlock } from './types';

/*
 * The ALFI card reads and writes chat's model blocks through chat's public API with the user's
 * token and household; the dashboard backend stores nothing about LLM providers (ADR 0010 §5).
 */

const DEFAULT_PATH = 'chat/model-blocks/household-default';

/** The household's default shared model block, or null when the household has none yet. */
export async function fetchHouseholdModelBlock(): Promise<ModelBlock | null> {
  try {
    return await api.get(DEFAULT_PATH).json<ModelBlock>();
  } catch (error) {
    if (isApiError(error) && error.status === 404 && error.code === 'not_found') return null;
    throw error;
  }
}

/** Every model block the caller may use: own, household-shared and bootstrap blocks. */
export async function fetchModelBlocks(): Promise<ModelBlock[]> {
  const blocks = await api.get('chat/model-blocks').json<ModelBlock[] | null>();
  return blocks ?? [];
}

/** Creates or updates the household's default shared model block (OWNER and ADMIN only). */
export async function saveHouseholdModelBlock(update: HouseholdModelBlockUpdate): Promise<ModelBlock> {
  return await api.put(DEFAULT_PATH, update).json<ModelBlock>();
}

/** Runs chat's health check of one model block and returns the block with the fresh result. */
export async function checkModelBlock(id: string): Promise<ModelBlock> {
  return await api.post(`chat/model-blocks/${encodeURIComponent(id)}/health-check`).json<ModelBlock>();
}
