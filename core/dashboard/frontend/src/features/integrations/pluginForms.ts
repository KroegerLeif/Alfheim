import type { PluginUiRegistry } from './types';

/**
 * Settings forms of the plugins this frontend knows, keyed by backend plugin type. A plugin adds
 * its entry here (name key and form component); the settings page passes the map to
 * `IntegrationsSection`. A type the backend lists without an entry still gets the generic card.
 */
export const PLUGIN_FORMS: PluginUiRegistry = {};
