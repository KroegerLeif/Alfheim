import { TranslationParams } from './types';

const PLACEHOLDER = /\{([^{}]+)\}/g;

/**
 * Replaces `{name}` placeholders in a translated message with `params[name]`.
 *
 * Substitution runs in a single pass with a replacer function, so parameter
 * values are inserted literally: `$&`, `$1` and `$$` in a value are not treated
 * as `String.prototype.replace` patterns, and a value that itself contains
 * `{other}` is not interpolated again. Placeholders without a matching
 * parameter are left unchanged.
 */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder,
  );
}
