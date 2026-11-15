import type { Metadata } from 'next';
import { BRAND_ASSETS, type AppSlug } from '../../assets';

/** Options for {@link createAppMetadata}. */
export interface AppMetadataOptions {
  /** App slug, e.g. `pantry`. Determines the default base path. */
  app: AppSlug;
  /**
   * Overrides the Next.js `basePath` the app is served under. Defaults to `/<app>`, or to the
   * root for the dashboard, matching the Caddy path prefixes.
   */
  basePath?: string;
}

/** The icon and manifest part of a Next.js `metadata` export. */
export type AppIconMetadata = Required<Pick<Metadata, 'icons' | 'manifest'>>;

function fileName(assetPath: string): string {
  return assetPath.slice(assetPath.lastIndexOf('/') + 1);
}

function resolveBasePath({ app, basePath }: AppMetadataOptions): string {
  const raw = basePath ?? (app === 'dashboard' ? '' : `/${app}`);
  return raw.replace(/\/+$/, '');
}

/**
 * Returns the favicon, apple-touch icon and web manifest block for a root layout's
 * `metadata`. The files come from the shared favicon bundle, which `sync-brand-assets.mjs` copies
 * into the app's `public/`. Next.js does not prefix metadata URLs with `basePath`, so the
 * helper does it.
 *
 * @example
 * export const metadata: Metadata = { title: 'Pantry', ...createAppMetadata({ app: 'pantry' }) };
 */
export function createAppMetadata(options: AppMetadataOptions): AppIconMetadata {
  const base = resolveBasePath(options);
  const url = (assetPath: string) => `${base}/${fileName(assetPath)}`;
  return {
    icons: {
      icon: [
        { url: url(BRAND_ASSETS.faviconIco), sizes: 'any' },
        { url: url(BRAND_ASSETS.favicon32), sizes: '32x32', type: 'image/png' },
        { url: url(BRAND_ASSETS.favicon16), sizes: '16x16', type: 'image/png' },
      ],
      apple: [{ url: url(BRAND_ASSETS.appleTouchIcon), sizes: '180x180', type: 'image/png' }],
    },
    manifest: url(BRAND_ASSETS.siteWebmanifest),
  };
}
