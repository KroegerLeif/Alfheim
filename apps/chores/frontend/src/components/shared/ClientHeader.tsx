"use client";

import { ClientHeader as SharedClientHeader } from "@alfheim/shared";

export function ClientHeader() {
  return (
    <SharedClientHeader
      appName="chores"
      brandTitle="ALFHEIM // CHORES"
    />
  );
}
