/** Backend plugin type of Home Assistant. */
export const HOME_ASSISTANT_TYPE = 'homeassistant';

/** The only action this build offers: create a one-off chore instance from a template. */
export const ACTION_CREATE_CHORE = 'chores.create_instance';

/** Non-secret settings of the Home Assistant plugin (`config`). */
export interface HomeAssistantSettings {
  pinned_entities: string[];
  allow_control: boolean;
}

/** A rule mapping a webhook event type to an action. */
export interface ActionRule {
  id: string;
  event_type: string;
  action: string;
  params: { template_id?: string };
  enabled: boolean;
}

/** Body of `POST .../rules`. */
export interface ActionRuleInput {
  event_type: string;
  action: string;
  params: { template_id: string };
}

/** A received webhook event as the audit list shows it. */
export interface WebhookEvent {
  event_id: string;
  event_type: string;
  status: 'received' | 'executed' | 'skipped' | 'ignored' | 'failed' | string;
  action: string;
  detail: string;
  received_at: string;
}

/** Body of `GET .../webhook`; the secret is never part of it. */
export interface WebhookInfo {
  webhook_id: string;
  has_secret: boolean;
  path: string;
}

/** Body of `POST .../webhook/secret`: the only answer that carries the secret. */
export interface WebhookSecret extends WebhookInfo {
  secret: string;
}

/** Entity ids look like `light.kitchen`, as the backend validates them. */
export const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;

/** Event types the backend accepts. */
export const EVENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

/** Reads the settings out of a plugin's config, with the defaults for missing fields. */
export function readSettings(config: Record<string, unknown> | null | undefined): HomeAssistantSettings {
  const pinned = Array.isArray(config?.pinned_entities) ? (config.pinned_entities as unknown[]) : [];
  return {
    pinned_entities: pinned.filter((id): id is string => typeof id === 'string'),
    allow_control: config?.allow_control === true,
  };
}
