interface InlineErrorProps {
  message: string | null;
  className?: string;
}

/** Visible, announced error banner for failed requests. Renders nothing without a message. */
export function InlineError({ message, className = "" }: InlineErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`break-words rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400 ${className}`.trim()}
    >
      {message}
    </div>
  );
}
