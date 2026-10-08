export interface ErrorNoticeProps {
  message: string;
  className?: string;
}

/** Inline error strip. Long server messages wrap instead of widening the page. */
export function ErrorNotice({ message, className = "" }: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className={`border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg break-words ${className}`}
    >
      {message}
    </div>
  );
}
