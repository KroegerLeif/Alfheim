import { Mail } from "lucide-react";
import { Template } from "./Template";

export interface LoginVerifyEmailProps {
  kcContext?: {
    url?: {
      loginAction?: string;
      loginUrl?: string;
    };
    user?: {
      email?: string;
    };
    message?: {
      type: "success" | "warning" | "error" | "info";
      summary: string;
    };
  };
}

export function LoginVerifyEmail({ kcContext }: LoginVerifyEmailProps) {
  const url = kcContext?.url || {};
  const user = kcContext?.user || {};

  return (
    <Template headerNode="Verify Email Address" message={kcContext?.message}>
      <div className="flex flex-col items-center justify-center space-y-4 py-3 text-center">
        <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
          <Mail className="w-7 h-7" />
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">
          We have sent a verification email to{" "}
          <strong className="text-text-main font-semibold">{user.email || "your registered email"}</strong>.
          Please click the link in the email to complete verification.
        </p>

        <form action={url.loginAction || "#"} method="post" className="w-full pt-2">
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl border border-subtle bg-surface-elevated hover:bg-surface-canvas text-text-main text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main cursor-pointer"
          >
            Resend Verification Email
          </button>
        </form>
      </div>

      <div className="pt-2 text-center text-xs text-text-muted">
        <a href={url.loginUrl || "#login"} className="text-primary-main hover:underline font-semibold">
          Back to sign in
        </a>
      </div>
    </Template>
  );
}
