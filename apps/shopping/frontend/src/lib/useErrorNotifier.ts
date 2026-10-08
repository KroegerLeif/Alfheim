import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useNotifications } from "@/components/shared/Notifications";
import { describeApiError } from "./apiError";

/**
 * Returns a callback that shows a failed request as a localized notification.
 * `fallbackKey` is a key of the `Error` namespace describing what failed.
 */
export function useErrorNotifier() {
  const t = useTranslations("Error");
  const { notifyError } = useNotifications();
  return useCallback(
    (error: unknown, fallbackKey: string) => notifyError(describeApiError(error, t(fallbackKey), t("unreachable"))),
    [notifyError, t]
  );
}
