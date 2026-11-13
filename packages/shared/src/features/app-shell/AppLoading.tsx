'use client';

import { useTranslation } from '../i18n/utils/useTranslation';

/** Props of {@link AppLoading}. */
export interface AppLoadingProps {
  /** Translation key of the message. Defaults to `common.loading`. */
  messageKey?: string;
}

/**
 * The route-level loading state of every app's `[locale]/loading.tsx`: a spinner and a
 * translated message, announced to assistive technology as a status.
 */
export function AppLoading({ messageKey = 'common.loading' }: AppLoadingProps) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex items-center justify-center">
      <div role="status" className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent"
        />
        <p className="text-sm font-mono tracking-wide text-[var(--text-muted)]">{t(messageKey)}</p>
      </div>
    </div>
  );
}

