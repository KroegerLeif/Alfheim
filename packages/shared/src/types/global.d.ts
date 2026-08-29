export interface KeycloakInstance {
  token?: string;
  authenticated?: boolean;
  updateToken?: (minValidity?: number) => Promise<boolean>;
  login?: (options?: unknown) => Promise<void> | void;
}

declare global {
  interface Window {
    __keycloak_instance__?: KeycloakInstance;
  }
}
