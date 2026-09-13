"use client";

import { ClientHeader as SharedClientHeader } from "@alfheim/shared";

export function ClientHeader() {
  return (
    <SharedClientHeader
      appName="library"
      brandTitle="ALFHEIM // LIBRARY"
    />
  );
}
