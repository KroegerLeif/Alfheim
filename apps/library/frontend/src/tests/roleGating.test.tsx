import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { ProviderCard } from "@/features/providers/components/ProviderCard";
import { LocationTreeNodeItem } from "@/features/locations/components/LocationTreeNodeItem";
import { ActiveLoansList } from "@/features/lending/components/ActiveLoansList";
import { ItemDialog } from "@/features/item-dialog/ItemDialog";
import { makeItem } from "@/features/catalog/tests/fixtures";
import { makeRecord } from "@/features/lending/tests/fixtures";
import type { ProviderSubscription } from "@/features/providers/types";
import type { LocationNode } from "@/features/locations/types";

const provider: ProviderSubscription = {
  id: "prov-1",
  household_id: "hh-1",
  provider_name: "Netflix",
  provider_type: "STREAMING",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const location: LocationNode = {
  id: "loc-1",
  household_id: "hh-1",
  name: "Living Room",
  description: null,
  parent_id: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  children: [],
};

function renderAll(role: string) {
  return renderWithProviders(
    <>
      <ProviderCard provider={provider} onToggleActive={vi.fn()} onDelete={vi.fn()} />
      <LocationTreeNodeItem node={location} onAddChild={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />
      <ActiveLoansList loans={[makeRecord()]} onReturnItem={vi.fn()} />
    </>,
    { role }
  );
}

function renderDialog(role: string) {
  return renderWithProviders(
    <ItemDialog
      open
      item={makeItem()}
      onOpenChange={vi.fn()}
      locations={[]}
      providers={[]}
      onSuccess={vi.fn()}
    />,
    { role }
  );
}

const ADMIN_DELETES = [/^Delete$/, /Delete location Living Room/];

describe("household role gating", () => {
  it("GUEST sees no provider, location or lending controls", () => {
    renderAll("GUEST");
    expect(screen.queryByRole("button", { name: /deactivate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add location/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /mark as returned/i })).toBeNull();
    for (const name of ADMIN_DELETES) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("GUEST opens items read-only with a hint on the save button", () => {
    renderDialog("GUEST");
    expect(screen.getByLabelText(/^Title/)).toBeDisabled();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    expect(save.closest("[title]")).toHaveAttribute("title", expect.stringMatching(/Guests can view/));
  });

  it("MEMBER can edit but provider and location deletes are disabled with a hint", () => {
    renderAll("MEMBER");
    expect(screen.getByRole("button", { name: /deactivate/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /mark as returned/i })).toBeEnabled();
    for (const name of ADMIN_DELETES) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button.closest("[title]")).toHaveAttribute("title", expect.stringMatching(/admins and owners/));
    }
  });

  it("MEMBER can save items", () => {
    renderDialog("MEMBER");
    expect(screen.getByLabelText(/^Title/)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("ADMIN gets every delete enabled", () => {
    renderAll("ADMIN");
    for (const name of ADMIN_DELETES) expect(screen.getByRole("button", { name })).toBeEnabled();
    expect(screen.queryByTestId("permission-hint")).toBeNull();
  });
});
