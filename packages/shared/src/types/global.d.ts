export interface OidcInstance {
  token?: string;
  authenticated?: boolean;
  updateToken?: (minValidity?: number) => Promise<boolean>;
  login?: (options?: unknown) => Promise<void> | void;
}

declare global {
  interface Window {
    __alfheim_oidc_instance__?: OidcInstance;
  }
}
