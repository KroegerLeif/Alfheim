import { AlertTriangle } from "lucide-react";
import { Template } from "./Template";

export interface ErrorProps {
  kcContext?: {
    url?: {
      loginUrl?: string;
    };
    message?: {
      summary?: string;
    };
    client?: {
      baseUrl?: string;
    };
  };
}

export function Error({ kcContext }: ErrorProps) {
  const url = kcContext?.url || {};
  const message = kcContext?.message?.summary || "An unexpected authentication error occurred.";
  const redirectUrl = url.loginUrl || kcContext?.client?.baseUrl || "/";

  return (
    <Template headerNode="Authentication Error" displayMessage={false}>
      <div className="flex flex-col items-center text-center space-y-4 py-3">
        <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs text-left w-full font-medium leading-relaxed">
          {message}
        </div>

        <a
          href={redirectUrl}
          className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover text-white text-sm font-semibold shadow-md transition-colors"
        >
          Back to Application
        </a>
      </div>
    </Template>
  );
}
