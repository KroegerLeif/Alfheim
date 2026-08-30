import { Clock } from "lucide-react";
import { Template } from "./Template";

export interface LoginPageExpiredProps {
  kcContext?: {
    url?: {
      loginRestartFlowUrl?: string;
      loginAction?: string;
    };
    message?: {
      summary?: string;
    };
  };
}

export function LoginPageExpired({ kcContext }: LoginPageExpiredProps) {
  const url = kcContext?.url || {};

  return (
    <Template headerNode="Session Expired" displayMessage={false}>
      <div className="flex flex-col items-center text-center space-y-4 py-3">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
          <Clock className="w-7 h-7" />
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">
          Your login session has expired or the page was left idle for too long.
        </p>

        <a
          href={url.loginRestartFlowUrl || url.loginAction || "#restart"}
          className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover text-white text-sm font-semibold shadow-md transition-colors"
        >
          Restart Login Flow
        </a>
      </div>
    </Template>
  );
}
