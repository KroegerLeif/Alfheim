import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAUNCHER_ICON, LAUNCHER_ICON_NAMES, LAUNCHER_ICONS, launcherIcon } from '../icons';
import { LAUNCHER_PRESETS } from '../presets';
import { safeHref } from '../safeHref';
import en from '../../../../../../../packages/shared/src/features/i18n/locales/en/dashboard.json';
import de from '../../../../../../../packages/shared/src/features/i18n/locales/de/dashboard.json';
import pl from '../../../../../../../packages/shared/src/features/i18n/locales/pl/dashboard.json';

const backendIcons = path.resolve(__dirname, '../../../../../backend/internal/features/launchers/icons.go');

describe('launcher icons', () => {
  it('match the backend allowlist exactly', () => {
    const source = fs.readFileSync(backendIcons, 'utf8');
    const block = source.slice(source.indexOf('var allowedIcons'), source.indexOf('\n}\n'));
    const names = [...block.matchAll(/"([a-z0-9-]+)": \{\}/g)].map((m) => m[1]).sort();
    expect(names).toEqual(LAUNCHER_ICON_NAMES);
  });

  it('cover every preset and the default', () => {
    for (const preset of LAUNCHER_PRESETS) expect(LAUNCHER_ICONS[preset.icon]).toBeDefined();
    expect(LAUNCHER_ICONS[DEFAULT_LAUNCHER_ICON]).toBeDefined();
  });

  it('fall back to the link icon for unknown names', () => {
    expect(launcherIcon('skull')).toBe(LAUNCHER_ICONS.link);
    expect(launcherIcon('house')).toBe(LAUNCHER_ICONS.house);
  });

  it('have a label in every locale', () => {
    for (const dict of [en, de, pl]) {
      const labels = dict.dashboard.launchers.icons as Record<string, string>;
      expect(Object.keys(labels).sort()).toEqual(LAUNCHER_ICON_NAMES);
    }
  });
});

describe('safeHref', () => {
  it('keeps absolute http and https URLs', () => {
    expect(safeHref('https://jellyfin.home:8096/web')).toBe('https://jellyfin.home:8096/web');
    expect(safeHref('http://ha.lan:8123')).toBe('http://ha.lan:8123');
  });

  it('drops other schemes, credentials and relative URLs', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,hi')).toBeUndefined();
    expect(safeHref('https://user:pass@a.example')).toBeUndefined();
    expect(safeHref('/pantry')).toBeUndefined();
  });
});
