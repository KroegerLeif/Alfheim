import React, { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider, StaticHouseholdProvider } from "@alfheim/shared";
import { HTTPError, type NormalizedOptions } from "ky";

type Language = "de" | "en" | "pl";

interface ProviderOptions {
  language?: Language;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** Wrapper with the real dictionaries, a query client and an active household. */
export function createWrapper({ language = "en" }: ProviderOptions = {}) {
  const queryClient = createQueryClient();
  const Household = StaticHouseholdProvider as React.FC<{ householdId: string; children?: ReactNode }>;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LanguageProvider defaultLanguage={language}>
        <Household householdId="hh-1">
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </Household>
      </LanguageProvider>
    );
  }
  return Wrapper;
}

export function renderWithProviders(
  ui: ReactElement,
  { language, ...options }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {}
) {
  return render(ui, { wrapper: createWrapper({ language }), ...options });
}

/** Build the error ky throws for a non-2xx response, with an optional JSON body. */
export function makeHttpError(status: number, body?: unknown): HTTPError {
  const response = new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  return new HTTPError(response, new Request("http://localhost/api"), {} as NormalizedOptions);
}
