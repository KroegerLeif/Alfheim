"use client";

import { ClientHeader as SharedClientHeader, useTranslation } from "@alfheim/shared";

export function ClientHeader() {
  const { t } = useTranslation();
  return <SharedClientHeader appName="chat" brandTitle={t("Chat.brandTitle")} />;
}
