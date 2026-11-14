import { describe, expect, it } from 'vitest';
import { DEFAULT_CUSTOM_COLORS, withDefaultCustomColors } from '../utils/customColors';

describe('withDefaultCustomColors', () => {
  it('returns the defaults for an empty config', () => {
    expect(withDefaultCustomColors({})).toEqual(DEFAULT_CUSTOM_COLORS);
  });

  it('keeps stored values and fills every missing one', () => {
    const result = withDefaultCustomColors({ dark: { primary: '#123456' }, light: { gold: '#abcdef' } });
    expect(result.dark).toEqual({ ...DEFAULT_CUSTOM_COLORS.dark, primary: '#123456' });
    expect(result.light).toEqual({ ...DEFAULT_CUSTOM_COLORS.light, gold: '#abcdef' });
  });
});
