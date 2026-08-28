import { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LanguageProvider, ThemeProvider } from "@alfheim/shared";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageProvider defaultLanguage={(locale === "de" || locale === "pl") ? locale : "en"}>
        <ThemeProvider defaultMode="dark" defaultVariant="nordic">
          <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-main)]">
            {children}
          </div>
        </ThemeProvider>
      </LanguageProvider>
    </NextIntlClientProvider>
  );
}
