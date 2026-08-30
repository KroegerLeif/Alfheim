import { useState } from "react";
import { KeyRound, Info } from "lucide-react";

interface PasskeyButtonProps {
  urlLoginAction?: string;
  isHttps?: boolean;
}

export function PasskeyButton({ urlLoginAction, isHttps = false }: PasskeyButtonProps) {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  return (
    <div className="relative w-full">
      <div className="flex items-center space-x-2">
        <a
          href={isHttps && urlLoginAction ? `${urlLoginAction}&webauthn=1` : "#passkey"}
          onClick={(e) => {
            if (!isHttps) {
              e.preventDefault();
              setShowTooltip(!showTooltip);
            }
          }}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary-main ${
            isHttps
              ? "bg-primary-main hover:bg-primary-hover text-white border-transparent cursor-pointer"
              : "bg-surface-elevated text-text-muted border-subtle cursor-not-allowed opacity-80"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Sign in with Passkey</span>
        </a>

        {!isHttps && (
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            aria-label="Passkey HTTPS requirement info"
            className="p-2 rounded-xl border border-subtle bg-surface-elevated text-text-muted hover:text-text-main transition-colors focus:outline-none"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      {showTooltip && !isHttps && (
        <div className="absolute left-0 right-0 -bottom-10 z-10 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-lg text-center animate-fade-in border border-slate-700">
          Available via HTTPS only (WebAuthn security requirement)
        </div>
      )}
    </div>
  );
}
