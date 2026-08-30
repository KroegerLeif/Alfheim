import { KcPage as KcLoginPage } from "./login/KcPage";
import { KcPage as KcAccountPage } from "./account/KcPage";

export interface KcContext {
  themeType: "login" | "account";
  pageId: string;
  [key: string]: unknown;
}

interface KcAppProps {
  kcContext?: KcContext;
}

export function KcApp({ kcContext }: KcAppProps) {
  if (!kcContext) {
    // Default fallback context for standalone local preview / dev mode
    const mockContext: KcContext = {
      themeType: "login",
      pageId: "login.ftl",
      url: {
        loginAction: "#",
        registrationUrl: "#register",
        loginResetCredentialsUrl: "#reset",
      },
      realm: {
        registrationAllowed: true,
        resetPasswordAllowed: true,
        rememberMe: true,
      },
    };
    return <KcLoginPage kcContext={mockContext} />;
  }

  if (kcContext.themeType === "account") {
    return <KcAccountPage kcContext={kcContext} />;
  }

  return <KcLoginPage kcContext={kcContext} />;
}
