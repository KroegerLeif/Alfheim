import { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppShell, LanguageProvider, ThemeProvider } from "@alfheim/shared";
import Providers from "./providers";
import { ClientHeader } from "@/components/shared/ClientHeader";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body
        className="min-h-full flex bg-[var(--surface-canvas)] text-[var(--text-main)] font-sans antialiased overflow-hidden selection:bg-[var(--primary-main)] selection:text-black"
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageProvider defaultLanguage={locale === "en" || locale === "pl" ? locale : "de"}>
            <ThemeProvider defaultMode="dark" defaultVariant="nordic">
              <Providers>
                <AppShell header={<ClientHeader />}>{children}</AppShell>
              </Providers>
            </ThemeProvider>
          </LanguageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
