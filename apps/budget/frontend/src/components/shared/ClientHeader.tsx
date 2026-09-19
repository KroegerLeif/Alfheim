"use client";

import { ClientHeader as SharedClientHeader } from "@alfheim/shared";

/** Shared Alfheim header (back to dashboard, household switcher, language, theme, auth). */
export function ClientHeader() {
  return <SharedClientHeader appName="budget" brandTitle="ALFHEIM // BUDGET" />;
}
