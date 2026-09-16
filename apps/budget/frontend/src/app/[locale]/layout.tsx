import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AuthGuard, LanguageProvider, ThemeProvider, AppShell } from "@alfheim/shared";
import Providers from "./providers";

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
            <Providers>
              <AppShell>
                <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-main)]">
                  {children}
                </div>
              </AppShell>
            </Providers>
          </ThemeProvider>
        </LanguageProvider>
      </NextIntlClientProvider>
    </AuthGuard>
  );
}
