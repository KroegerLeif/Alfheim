import { beforeEach, describe, expect, it, vi } from 'vitest';

const createNavigationMock = vi.fn((config: unknown) => ({ config }));
const createMiddlewareMock = vi.fn((config: unknown) => ({ config }));
const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next-intl/navigation', () => ({ createNavigation: createNavigationMock }));
vi.mock('next-intl/middleware', () => ({ default: createMiddlewareMock }));
vi.mock('next-intl/server', () => ({ getRequestConfig: (fn: unknown) => fn }));
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

type RequestConfigFn = (params: { requestLocale: Promise<string | undefined> }) => Promise<{ locale: string; messages: unknown }>;

describe('next-intl factories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isAlfheimLocale accepts only the served locales', async () => {
    const { isAlfheimLocale, ALFHEIM_LOCALES } = await import('../routing');
    expect(ALFHEIM_LOCALES).toEqual(['en', 'de', 'pl']);
    expect(isAlfheimLocale('de')).toBe(true);
    expect(isAlfheimLocale('fr')).toBe(false);
    expect(isAlfheimLocale(undefined)).toBe(false);
  });

  it('createNavigation passes the shared locales and prefix', async () => {
    const { createNavigation } = await import('../navigation');
    createNavigation();
    expect(createNavigationMock).toHaveBeenCalledWith({ locales: ['en', 'de', 'pl'], localePrefix: 'always' });
  });

  it('createProxy defaults to English and accepts another default locale', async () => {
    const { createProxy } = await import('../proxy');
    createProxy();
    createProxy({ defaultLocale: 'de' });
    expect(createMiddlewareMock).toHaveBeenNthCalledWith(1, { defaultLocale: 'en', locales: ['en', 'de', 'pl'], localePrefix: 'always' });
    expect(createMiddlewareMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ defaultLocale: 'de' }));
  });

  it('createRequestConfig returns the messages and rejects unknown locales', async () => {
    const { createRequestConfig } = await import('../request');
    const loadMessages = vi.fn(() => ({ common: {} }) as never);
    const config = createRequestConfig({ loadMessages }) as unknown as RequestConfigFn;
    await expect(config({ requestLocale: Promise.resolve('pl') })).resolves.toEqual({ locale: 'pl', messages: { common: {} } });
    expect(loadMessages).toHaveBeenCalledWith('pl');
    await expect(config({ requestLocale: Promise.resolve('xx') })).rejects.toThrow('NEXT_NOT_FOUND');

    const sharedConfig = createRequestConfig() as unknown as RequestConfigFn;
    const result = await sharedConfig({ requestLocale: Promise.resolve('en') });
    expect(result.messages).toHaveProperty('common');
  });
});
