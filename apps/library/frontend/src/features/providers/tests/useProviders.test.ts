import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProviders } from "../hooks/useProviders";
import * as providersApi from "../api/providersApi";
import { ProviderSubscription } from "../types";

vi.mock("../api/providersApi");

const mockProviders: ProviderSubscription[] = [
  {
    id: "p-1",
    household_id: "hh-1",
    name: "Netflix",
    provider_type: "MOVIE",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
  return Wrapper;
}

describe("useProviders hook", () => {
  it("fetches and returns streaming providers", async () => {
    vi.spyOn(providersApi, "fetchProviders").mockResolvedValue(mockProviders);

    const { result } = renderHook(() => useProviders(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.providers).toHaveLength(1);
    expect(result.current.providers[0].name).toBe("Netflix");
  });

  it("calls createProvider when creating new subscription", async () => {
    vi.spyOn(providersApi, "fetchProviders").mockResolvedValue([]);
    const createSpy = vi.spyOn(providersApi, "createProvider").mockResolvedValue(mockProviders[0]);

    const { result } = renderHook(() => useProviders(), {
      wrapper: createWrapper(),
    });

    await result.current.createProvider({
      name: "Netflix",
      provider_type: "MOVIE",
    });

    expect(createSpy).toHaveBeenCalledWith({
      name: "Netflix",
      provider_type: "MOVIE",
    });
  });
});
