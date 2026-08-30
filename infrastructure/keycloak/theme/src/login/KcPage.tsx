import { Login } from "./Login";
import { Register } from "./Register";
import { LoginResetPassword } from "./LoginResetPassword";
import { LoginVerifyEmail } from "./LoginVerifyEmail";
import { Error as LoginError } from "./Error";
import { LoginPageExpired } from "./LoginPageExpired";

export interface KcPageProps {
  kcContext: {
    pageId: string;
    [key: string]: unknown;
  };
}

export function KcPage({ kcContext }: KcPageProps) {
  switch (kcContext.pageId) {
    case "login.ftl":
      return <Login kcContext={kcContext as unknown as React.ComponentProps<typeof Login>["kcContext"]} />;
    case "register.ftl":
      return <Register kcContext={kcContext as unknown as React.ComponentProps<typeof Register>["kcContext"]} />;
    case "login-reset-password.ftl":
      return <LoginResetPassword kcContext={kcContext as unknown as React.ComponentProps<typeof LoginResetPassword>["kcContext"]} />;
    case "login-verify-email.ftl":
      return <LoginVerifyEmail kcContext={kcContext as unknown as React.ComponentProps<typeof LoginVerifyEmail>["kcContext"]} />;
    case "error.ftl":
    case "login-error.ftl":
      return <LoginError kcContext={kcContext as unknown as React.ComponentProps<typeof LoginError>["kcContext"]} />;
    case "login-page-expired.ftl":
      return <LoginPageExpired kcContext={kcContext as unknown as React.ComponentProps<typeof LoginPageExpired>["kcContext"]} />;
    default:
      return <Login kcContext={kcContext as unknown as React.ComponentProps<typeof Login>["kcContext"]} />;
  }
}
