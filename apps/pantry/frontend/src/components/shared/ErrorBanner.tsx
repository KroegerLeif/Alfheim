import { AlertCircle } from "lucide-react";

interface ErrorBannerProps {
  /** Already localized message. */
  message: string;
}

/**
 * ErrorBanner
 * Red inline banner announced to assistive technology; long server text wraps instead of overflowing.
 */
export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="border border-red-800/40 bg-red-950/20 text-red-400 p-3 text-xs flex items-start gap-2 font-bold leading-normal rounded min-w-0"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}
