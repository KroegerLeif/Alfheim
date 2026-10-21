import React, { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider, StaticHouseholdProvider } from "@alfheim/shared";
import { HTTPError, NetworkError, type NormalizedOptions } from "ky";

type Language = "de" | "en" | "pl";

interface ProviderOptions {
  language?: Language;
  /** Caller's role in the active household (default OWNER). */
  role?: string;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** Wrapper with the real dictionaries, a query client and an active household. */
export function createWrapper({ language = "en", role = "OWNER" }: ProviderOptions = {}) {
  const queryClient = createQueryClient();
  const Household = StaticHouseholdProvider as React.FC<{
    householdId: string;
    value?: { role: string };
    children?: ReactNode;
  }>;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LanguageProvider defaultLanguage={language}>
        <Household householdId="hh-1" value={{ role }}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </Household>
      </LanguageProvider>
    );
  }
  return Wrapper;
}

export function renderWithProviders(
  ui: ReactElement,
  { language, role, ...options }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {}
) {
  return render(ui, { wrapper: createWrapper({ language, role }), ...options });
}

/** Build the error ky throws for a non-2xx response, with an optional JSON body. */
export function makeHttpError(status: number, body?: unknown): HTTPError {
  const response = new Response(null, { status });
  const error = new HTTPError(response, new Request("http://localhost/api"), {} as NormalizedOptions);
  // ky parses the response body into `data` before it throws.
  error.data = body as HTTPError["data"];
  return error;
}

/** Builds the error ky throws when `fetch` fails without a response (offline, DNS, refused). */
export function makeNetworkError(): NetworkError {
  return new NetworkError(new Request("http://localhost/api"), { cause: new TypeError("Failed to fetch") });
}
