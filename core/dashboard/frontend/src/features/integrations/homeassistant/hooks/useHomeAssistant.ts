import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveHousehold } from '@alfheim/shared';
import { deleteRule, fetchEvents, fetchRules, fetchWebhook, rotateSecret, saveRule } from '../api/homeAssistantApi';
import type { ActionRule, ActionRuleInput, WebhookEvent, WebhookInfo, WebhookSecret } from '../types';

const KEY = 'home-assistant';

function useKey(part: string) {
  const { householdId } = useActiveHousehold();
  return [KEY, part, householdId];
}

function useReady() {
  return useActiveHousehold().status === 'ready';
}

/** The household's action rules. */
export function useRules() {
  return useQuery<ActionRule[]>({ queryKey: useKey('rules'), queryFn: fetchRules, enabled: useReady() });
}

/** The 20 most recent webhook events, refreshed every 30 seconds. */
export function useWebhookEvents() {
  return useQuery<WebhookEvent[]>({
    queryKey: useKey('events'),
    queryFn: fetchEvents,
    enabled: useReady(),
    refetchInterval: 30_000,
  });
}

/** The webhook id and whether a secret exists. */
export function useWebhookInfo() {
  return useQuery<WebhookInfo>({ queryKey: useKey('webhook'), queryFn: fetchWebhook, enabled: useReady() });
}

function useInvalidate(part: string) {
  const client = useQueryClient();
  const key = useKey(part);
  return () => client.invalidateQueries({ queryKey: key });
}

/** Saves a rule and reloads the list. */
export function useSaveRule() {
  const invalidate = useInvalidate('rules');
  return useMutation<ActionRule, Error, ActionRuleInput>({ mutationFn: saveRule, onSuccess: invalidate });
}

/** Deletes a rule and reloads the list. */
export function useDeleteRule() {
  const invalidate = useInvalidate('rules');
  return useMutation<void, Error, string>({ mutationFn: deleteRule, onSuccess: invalidate });
}

/** Generates a new webhook secret; the caller shows the answer once and keeps it nowhere. */
export function useRotateSecret() {
  const invalidate = useInvalidate('webhook');
  return useMutation<WebhookSecret, Error, void>({ mutationFn: () => rotateSecret(), onSuccess: invalidate });
}
