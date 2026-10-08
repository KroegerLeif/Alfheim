"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, X } from "lucide-react";

interface Notice {
  id: number;
  message: string;
}

interface NotificationsApi {
  /** Show an already localized error message until it is dismissed or times out. */
  notifyError: (message: string) => void;
}

const NotificationsContext = createContext<NotificationsApi | null>(null);

const MAX_NOTICES = 4;

interface NotificationsProviderProps {
  children: ReactNode;
  /** How long a message stays visible. */
  dismissAfterMs?: number;
}

/**
 * Provides `useNotifications` and renders the error messages as a stack of dismissible alerts.
 * The stack sits above modals (z-index 9999) so a failure inside a dialog stays visible.
 */
export function NotificationsProvider({ children, dismissAfterMs = 8000 }: NotificationsProviderProps) {
  const t = useTranslations("Error");
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const notifyError = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setNotices((current) => [...current.filter((notice) => notice.message !== message), { id, message }].slice(-MAX_NOTICES));
      timers.current.set(id, setTimeout(() => dismiss(id), dismissAfterMs));
    },
    [dismiss, dismissAfterMs]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo(() => ({ notifyError }), [notifyError]);

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      {notices.length > 0 && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[10000] flex flex-col gap-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              role="alert"
              className="glass-modal border border-red-500/40 bg-red-950/80 text-red-100 rounded-xl p-3 text-xs font-bold leading-normal flex items-start gap-2 min-w-0"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{notice.message}</span>
              <button
                type="button"
                onClick={() => dismiss(notice.id)}
                className="shrink-0 p-0.5 rounded hover:bg-white/10 cursor-pointer"
                aria-label={t("dismiss")}
                title={t("dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsApi {
  const api = useContext(NotificationsContext);
  if (!api) throw new Error("useNotifications must be used inside a NotificationsProvider");
  return api;
}
