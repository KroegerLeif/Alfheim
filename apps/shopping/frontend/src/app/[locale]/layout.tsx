import { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppShell, AuthGuard, LanguageProvider, ThemeProvider, HouseholdProvider, HouseholdGate } from "@alfheim/shared";
import Providers from "./providers";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { getLocalizedMetadata } from "@/lib/metadata";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return getLocalizedMetadata(locale);
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  // Retrieve loaded locale messages
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runtime configuration (OIDC issuer/client id, frontend/API URLs) is served
          by a dynamic route handler, never baked into the prerendered HTML: the
          container's environment is not known at CI build time.
        */}
        <script src="/shopping/runtime-config.js" />
      </head>
      <body
        className="min-h-screen h-screen w-full flex flex-col bg-background text-foreground font-sans antialiased overflow-hidden selection:bg-primary selection:text-white"
        suppressHydrationWarning
      >
        <AuthGuard basePath="/shopping">
          <NextIntlClientProvider locale={locale} messages={messages}>
            <LanguageProvider defaultLanguage={locale as "de" | "en" | "pl"}>
              <ThemeProvider defaultMode="dark" defaultVariant="nordic">
                <HouseholdProvider>
                  <Providers>
                    <AppShell header={<Header />} sidebar={<Sidebar />}>
                      <HouseholdGate>
                        <div className="p-4 md:p-6">{children}</div>
                      </HouseholdGate>
                    </AppShell>
                  </Providers>
                </HouseholdProvider>
              </ThemeProvider>
            </LanguageProvider>
          </NextIntlClientProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
