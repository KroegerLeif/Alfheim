import type { ComponentType } from 'react';

/** Health statuses the dashboard backend stores after a connection test. */
export const PLUGIN_HEALTH_STATUSES = [
  'unknown',
  'ok',
  'host_not_allowed',
  'unreachable',
  'timeout',
  'auth_failed',
  'invalid_response',
  'invalid_config',
  'credentials_unavailable',
  'error',
] as const;

export type PluginHealthStatus = (typeof PLUGIN_HEALTH_STATUSES)[number];

/** Stored result of the last connection test. */
export interface PluginHealth {
  status: string;
  detail: string;
  checked_at: string | null;
}

/** A plugin type as `GET /api/v1/integrations/plugins` lists it; never carries credentials. */
export interface Plugin {
  type: string;
  configured: boolean;
  enabled: boolean;
  base_url: string;
  config: Record<string, unknown>;
  has_credentials: boolean;
  health: PluginHealth;
  updated_at: string | null;
}

/** Body of `GET /api/v1/integrations/plugins`. */
export interface PluginList {
  items: Plugin[] | null;
  encryption_available: boolean;
}

/**
 * Body of `PUT /api/v1/integrations/plugins/{type}`. Credentials are write-only: omit them to keep
 * the stored ones, send an object to replace them, send `{}` to remove them.
 */
export interface PluginUpdate {
  enabled: boolean;
  base_url: string;
  config: Record<string, unknown>;
  credentials?: Record<string, string>;
}

/** Props the plugin card hands to a plugin's own settings form. */
export interface PluginFormProps {
  plugin: Plugin;
  /** False when the server has no INTEGRATIONS_ENCRYPTION_KEY: the form must not offer credential fields. */
  encryptionAvailable: boolean;
  isSaving: boolean;
  /** Saves the form; the card keeps the enable state unless the update changes it. */
  onSubmit: (update: PluginUpdate) => void;
}

/** What the settings UI knows about one plugin type: its translated name and its settings form. */
export interface PluginUiEntry {
  /** i18n key of the plugin's display name. */
  titleKey: string;
  Form: ComponentType<PluginFormProps>;
}

/** Extension point: each plugin adds one entry keyed by its backend type. */
export type PluginUiRegistry = Readonly<Record<string, PluginUiEntry>>;
