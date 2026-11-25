'use client';

import type { PluginFormProps } from '../types';
import { MediaServerForm } from './MediaServerForm';
import type { MediaCredentialField } from './types';

const JELLYFIN_FIELDS: MediaCredentialField[] = [
  { name: 'api_key', labelKey: 'dashboard.integrations.media.api_key', type: 'password' },
];

const NAVIDROME_FIELDS: MediaCredentialField[] = [
  { name: 'username', labelKey: 'dashboard.integrations.media.username', type: 'text' },
  { name: 'password', labelKey: 'dashboard.integrations.media.password', type: 'password' },
];

/** Jellyfin settings: base URL and an API key from the Jellyfin dashboard. */
export function JellyfinForm(props: PluginFormProps) {
  return <MediaServerForm {...props} fields={JELLYFIN_FIELDS} urlPlaceholderKey="dashboard.integrations.media.jellyfin_url" />;
}

/** Navidrome settings: base URL, user name and password for Subsonic token authentication. */
export function NavidromeForm(props: PluginFormProps) {
  return <MediaServerForm {...props} fields={NAVIDROME_FIELDS} urlPlaceholderKey="dashboard.integrations.media.navidrome_url" />;
}
