import { useSyncExternalStore } from 'react';
import type { CustomPreset } from './components/CustomThemeBuilder';

const STORAGE_KEY = 'alfheim_custom_presets';

const DEFAULT_PRESETS: CustomPreset[] = [
  {
    id: 'preset-cyberpunk',
    name: 'Neon Cyberpunk',
    colors: {
      dark: { primary: '#ec4899', canvas: '#090d16', accent: '#00f0ff' },
      light: { primary: '#ec4899', canvas: '#fff0f6', accent: '#00f0ff' },
    },
  },
  {
    id: 'preset-minty',
    name: 'Minty Fresh',
    colors: {
      dark: { primary: '#10b981', canvas: '#061c15', accent: '#10b981' },
      light: { primary: '#059669', canvas: '#f0fdf4', accent: '#059669' },
    },
  },
];

const listeners = new Set<() => void>();

/** Serialized presets that could not be persisted (storage blocked or full); keeps them usable in memory. */
let unsavedRaw: string | undefined;
let snapshotRaw: string | null | undefined;
let snapshot: CustomPreset[] = DEFAULT_PRESETS;

function readRaw(): string | null {
  if (unsavedRaw !== undefined) return unsavedRaw;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parsePresets(raw: string | null): CustomPreset[] {
  if (!raw) return DEFAULT_PRESETS;
  try {
    return JSON.parse(raw) as CustomPreset[];
  } catch {
    return DEFAULT_PRESETS;
  }
}

/** Referentially stable between changes of the stored value, as useSyncExternalStore requires. */
function getSnapshot(): CustomPreset[] {
  const raw = readRaw();
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = parsePresets(raw);
  }
  return snapshot;
}

function getServerSnapshot(): CustomPreset[] {
  return DEFAULT_PRESETS;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      unsavedRaw = undefined;
      onChange();
    }
  };
  listeners.add(onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function writePresets(presets: CustomPreset[]): void {
  const raw = JSON.stringify(presets);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
    unsavedRaw = undefined;
  } catch {
    unsavedRaw = raw;
  }
  listeners.forEach((listener) => listener());
}

/**
 * The saved custom theme presets, persisted in localStorage. Before anything is saved (and on the
 * server render) the two built-in presets are returned.
 */
export function useCustomPresets(): [CustomPreset[], (presets: CustomPreset[]) => void] {
  const presets = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [presets, writePresets];
}
