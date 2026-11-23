/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

/** Latest released version (for example `v0.5.0`), injected by `vite.config.ts` from CHANGELOG.md. */
declare const __ALFHEIM_RELEASE__: string;
