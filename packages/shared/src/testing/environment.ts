/// <reference path="./jest-dom.d.ts" />
/// <reference path="./vitest-axe.d.ts" />
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

/** What MSW does with a request no handler matches. */
export type UnhandledFramePolicy = 'bypass' | 'warn' | 'error';

/** The part of an MSW `setupServer()` instance the shared lifecycle drives. */
export interface MockServerLike {
  listen(options: { onUnhandledFrame: UnhandledFramePolicy }): void;
  resetHandlers(): void;
  close(): void;
}

/** Options of {@link setupAlfheimTests}. */
export interface AlfheimTestOptions {
  /** MSW server to start before, reset after each and close after all tests. */
  server?: MockServerLike;
  /** Policy for requests no MSW handler matches. Defaults to `bypass`. */
  onUnhandledFrame?: UnhandledFramePolicy;
  /** Give `localStorage` and `sessionStorage` one shared store (the historic app setup). Default true. */
  sharedStorage?: boolean;
  /** Install a `window.matchMedia` double that never matches. Default false. */
  matchMedia?: boolean;
  /** Extra cleanup after every test, e.g. resetting an app's router double. */
  afterEach?: () => void;
}

/** In-memory Web Storage: Node's experimental global storage shadows jsdom's and lacks `getItem`. */
export function createStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * The common Vitest environment of every frontend: jest-dom and vitest-axe matchers, a 5 s
 * async-utility timeout (the monorepo gate runs suites in parallel, so a busy machine needs the
 * headroom; passing tests are not slowed down), in-memory storage and, optionally, the MSW
 * lifecycle and a `matchMedia` double. Call it once from the app's `src/tests/setup.ts`.
 */
export function setupAlfheimTests(options: AlfheimTestOptions = {}): void {
  const { server, onUnhandledFrame = 'bypass', sharedStorage = true, matchMedia = false } = options;
  expect.extend(axeMatchers);
  configure({ asyncUtilTimeout: 5000 });

  const local = createStorageMock();
  Object.defineProperty(globalThis, 'localStorage', { value: local, writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sharedStorage ? local : createStorageMock(),
    writable: true,
  });
  if (matchMedia) installMatchMedia();

  if (server) beforeAll(() => server.listen({ onUnhandledFrame }));
  afterEach(() => {
    server?.resetHandlers();
    options.afterEach?.();
  });
  if (server) afterAll(() => server.close());
}
