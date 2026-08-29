import { Template } from "./Template";
import { InputField } from "../components/InputField";
import { PasskeyButton } from "../components/PasskeyButton";
import { SocialProviders } from "../components/SocialProviders";

export interface LoginProps {
  kcContext?: {
    url?: {
      loginAction?: string;
      registrationUrl?: string;
      loginResetCredentialsUrl?: string;
    };
    login?: {
      username?: string;
      rememberMe?: boolean;
    };
    realm?: {
      registrationAllowed?: boolean;
      resetPasswordAllowed?: boolean;
      rememberMe?: boolean;
    };
    social?: {
      providers?: Array<{
        alias: string;
        providerId: string;
        displayName: string;
        loginUrl: string;
      }>;
    };
    message?: {
      type: "success" | "warning" | "error" | "info";
      summary: string;
    };
  };
}

export function Login({ kcContext }: LoginProps) {
  const url = kcContext?.url || {};
  const realm = kcContext?.realm || { registrationAllowed: true, resetPasswordAllowed: true, rememberMe: true };
  const login = kcContext?.login || {};

  return (
    <Template headerNode="Sign in to Alfheim" message={kcContext?.message}>
      <form
        action={url.loginAction || "#"}
        method="post"
        className="space-y-4"
      >
        <InputField
          label="Username or Email"
          name="username"
          defaultValue={login.username || ""}
          placeholder="user@alfheim.local"
          required
          autoFocus
        />

        <InputField
          label="Password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
        />

        <div className="flex items-center justify-between text-xs">
          {realm.rememberMe && (
            <label className="flex items-center space-x-2 cursor-pointer text-text-secondary">
              <input
                type="checkbox"
                name="rememberMe"
                defaultChecked={!!login.rememberMe}
                className="rounded border-subtle text-primary-main focus:ring-primary-main"
              />
              <span>Remember me</span>
            </label>
          )}

          {realm.resetPasswordAllowed && (
            <a
              href={url.loginResetCredentialsUrl || "#reset"}
              className="text-primary-main hover:underline font-medium"
            >
              Forgot password?
            </a>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-xl bg-primary-main hover:bg-primary-hover text-white text-sm font-semibold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main cursor-pointer"
        >
          Sign In
        </button>

        <PasskeyButton urlLoginAction={url.loginAction} isHttps={false} />

        <SocialProviders providers={kcContext?.social?.providers} />
      </form>

      {realm.registrationAllowed && (
        <div className="pt-3 text-center text-xs text-text-muted">
          Don't have an account?{" "}
          <a
            href={url.registrationUrl || "#register"}
            className="text-primary-main hover:underline font-semibold"
          >
            Create account
          </a>
        </div>
      )}
    </Template>
  );
}
