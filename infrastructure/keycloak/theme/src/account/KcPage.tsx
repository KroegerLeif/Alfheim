import { Account } from "./Account";

export interface KcAccountPageProps {
  kcContext: {
    pageId: string;
    [key: string]: unknown;
  };
}

export function KcPage({ kcContext }: KcAccountPageProps) {
  return <Account kcContext={kcContext as unknown as React.ComponentProps<typeof Account>["kcContext"]} />;
}
