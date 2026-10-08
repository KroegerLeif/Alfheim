import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithI18n } from "@/tests/test-utils";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import type { SyncQueueState } from "../types";

const idle: SyncQueueState = {
  pendingCount: 0,
  isSyncing: false,
  isOnline: true,
  lastError: null,
  droppedKeys: [],
};

function renderBadge(state: Partial<SyncQueueState> = {}, handlers: { onRetry?: () => void; onDismissDropped?: () => void } = {}) {
  return renderWithI18n(
    <SyncStatusBadge {...idle} {...state} onRetry={handlers.onRetry ?? vi.fn()} onDismissDropped={handlers.onDismissDropped} />
  );
}

describe("SyncStatusBadge", () => {
  it("shows the synced state when nothing is pending", () => {
    renderBadge();
    expect(screen.getByRole("status")).toHaveTextContent("Synced");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the number of sets waiting while offline", () => {
    renderBadge({ isOnline: false, pendingCount: 2 });
    expect(screen.getByRole("status")).toHaveTextContent("2 sets waiting to sync");
  });

  it("shows the offline label without queued sets", () => {
    renderBadge({ isOnline: false });
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
  });

  it("shows progress while syncing", () => {
    renderBadge({ isSyncing: true, pendingCount: 1 });
    expect(screen.getByRole("status")).toHaveTextContent("Syncing");
  });

  it("offers a retry after a failed sync", () => {
    const onRetry = vi.fn();
    renderBadge({ lastError: "Failed to fetch" }, { onRetry });

    expect(screen.getByRole("status")).toHaveTextContent("Sync Failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows pending sets while online", () => {
    renderBadge({ pendingCount: 3 });
    expect(screen.getByRole("status")).toHaveTextContent("3 sets waiting to sync");
  });

  it("announces discarded sets in a persistent alert that can be dismissed", () => {
    const onDismissDropped = vi.fn();
    renderBadge({ droppedKeys: ["a", "b"] }, { onDismissDropped });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sets that could not be saved and were discarded: 2");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismissDropped).toHaveBeenCalledTimes(1);
  });

  it("translates the discarded-sets warning", () => {
    renderWithI18n(
      <SyncStatusBadge {...idle} droppedKeys={["a"]} onRetry={vi.fn()} onDismissDropped={vi.fn()} />,
      "de"
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sätze, die nicht gespeichert werden konnten");
  });
});
