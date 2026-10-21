import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider, StaticHouseholdProvider } from "@alfheim/shared";
import { render as rtlRender, RenderOptions } from "@testing-library/react";

export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <StaticHouseholdProvider householdId="hh-1"><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></StaticHouseholdProvider>
  );
}

export function createTestWrapper(role = "OWNER") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <StaticHouseholdProvider householdId="hh-1" value={{ role }}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider defaultLanguage="en">
            {children}
          </LanguageProvider>
        </QueryClientProvider>
      </StaticHouseholdProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { role?: string }
) {
  const { role, ...renderOptions } = options ?? {};
  return rtlRender(ui, { wrapper: createTestWrapper(role), ...renderOptions });
}
