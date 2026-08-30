import { Template } from "./Template";
import { InputField } from "../components/InputField";

export interface LoginResetPasswordProps {
  kcContext?: {
    url?: {
      loginAction?: string;
      loginUrl?: string;
    };
    auth?: {
      attemptedUsername?: string;
    };
    message?: {
      type: "success" | "warning" | "error" | "info";
      summary: string;
    };
  };
}

export function LoginResetPassword({ kcContext }: LoginResetPasswordProps) {
  const url = kcContext?.url || {};
  const auth = kcContext?.auth || {};

  return (
    <Template
      headerNode="Reset Your Password"
      message={kcContext?.message}
    >
      <p className="text-xs text-text-secondary">
        Enter your email address or username and we will send you instructions to reset your password.
      </p>

      <form
        action={url.loginAction || "#"}
        method="post"
        className="space-y-4 pt-2"
      >
        <InputField
          label="Username or Email"
          name="username"
          defaultValue={auth.attemptedUsername || ""}
          placeholder="user@alfheim.local"
          required
          autoFocus
        />

        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover text-white text-sm font-semibold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main cursor-pointer"
        >
          Send Instructions
        </button>
      </form>

      <div className="pt-3 text-center text-xs text-text-muted">
        Remember your password?{" "}
        <a
          href={url.loginUrl || "#login"}
          className="text-primary-main hover:underline font-semibold"
        >
          Back to sign in
        </a>
      </div>
    </Template>
  );
}
