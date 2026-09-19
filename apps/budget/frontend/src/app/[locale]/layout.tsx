import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AuthGuard, LanguageProvider, ThemeProvider, AppShell, HouseholdProvider, HouseholdGate } from "@alfheim/shared";
import Providers from "./providers";
import { ClientHeader } from "@/components/shared/ClientHeader";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  const messages = await getMessages({ locale });

  return (
    <AuthGuard basePath="/budget">
      <NextIntlClientProvider locale={locale} messages={messages}>
        <LanguageProvider defaultLanguage={(locale === "de" || locale === "pl") ? locale : "en"}>
          <ThemeProvider defaultMode="dark" defaultVariant="nordic">
            <HouseholdProvider>
              <Providers>
                <AppShell header={<ClientHeader />}>
                  <HouseholdGate>
                    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-main)]">
                      {children}
                    </div>
                  </HouseholdGate>
                </AppShell>
              </Providers>
            </HouseholdProvider>
          </ThemeProvider>
        </LanguageProvider>
      </NextIntlClientProvider>
    </AuthGuard>
  );
}
