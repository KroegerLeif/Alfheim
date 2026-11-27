import { api } from '@/core/api/client';
import type { ActionRule, ActionRuleInput, WebhookEvent, WebhookInfo, WebhookSecret } from '../types';

const BASE = 'integrations/home-assistant';

/** The household's action rules (OWNER and ADMIN only). */
export async function fetchRules(): Promise<ActionRule[]> {
  const body = await api.get(`${BASE}/rules`).json<{ items: ActionRule[] | null }>();
  return body.items ?? [];
}

/** Creates or replaces the rule of the input's event type. */
export async function saveRule(input: ActionRuleInput): Promise<ActionRule> {
  return await api.post(`${BASE}/rules`, input).json<ActionRule>();
}

/** Removes one rule. */
export async function deleteRule(id: string): Promise<void> {
  await api.delete(`${BASE}/rules/${encodeURIComponent(id)}`);
}

/** The 20 most recent webhook events. */
export async function fetchEvents(): Promise<WebhookEvent[]> {
  const body = await api.get(`${BASE}/events`).json<{ items: WebhookEvent[] | null }>();
  return body.items ?? [];
}

/** The webhook id and whether a secret exists. */
export async function fetchWebhook(): Promise<WebhookInfo> {
  return await api.get(`${BASE}/webhook`).json<WebhookInfo>();
}

/** Generates a new secret; the answer is the only time it is shown. */
export async function rotateSecret(): Promise<WebhookSecret> {
  return await api.post(`${BASE}/webhook/secret`).json<WebhookSecret>();
}
