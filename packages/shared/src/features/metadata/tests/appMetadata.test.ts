import { describe, expect, it } from 'vitest';
import { createAppMetadata } from '../appMetadata';

describe('createAppMetadata', () => {
  it('prefixes every icon and the manifest with the app base path', () => {
    const metadata = createAppMetadata({ app: 'pantry' });
    expect(metadata.manifest).toBe('/pantry/site.webmanifest');
    expect(metadata.icons).toEqual({
      icon: [
        { url: '/pantry/favicon.ico', sizes: 'any' },
        { url: '/pantry/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/pantry/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: [{ url: '/pantry/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    });
  });

  it('serves the dashboard from the root', () => {
    expect(createAppMetadata({ app: 'dashboard' }).manifest).toBe('/site.webmanifest');
  });

  it('honours an explicit base path and strips trailing slashes', () => {
    expect(createAppMetadata({ app: 'chat', basePath: '/assistant/' }).manifest).toBe(
      '/assistant/site.webmanifest',
    );
  });
});
