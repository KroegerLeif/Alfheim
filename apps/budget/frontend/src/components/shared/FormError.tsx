export interface FormErrorProps {
  message: string | null;
}

/** Inline error line for dialog forms. Long server messages wrap instead of widening the dialog. */
export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-rose-500 break-words">
      {message}
    </p>
  );
}
