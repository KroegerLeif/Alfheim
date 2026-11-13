/**
 * App shell building blocks for Next.js frontends. Served from `@alfheim/shared/app-shell`
 * rather than the package root because it needs TanStack Query, which non-Next consumers of
 * the root barrel (the landing page) do not install.
 */
export * from './appQueryClient';
export * from './AppProviders';
export { AppLoading, type AppLoadingProps } from './AppLoading';
