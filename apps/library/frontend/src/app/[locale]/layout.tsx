import { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import {
  AppShell,
  AuthGuard,
  LanguageProvider,
  ThemeProvider,
  HouseholdProvider,
  HouseholdGate,
  getSharedMessages,
  type Language,
} from "@alfheim/shared";
import Providers from "./providers";
import { Sidebar } from "@/components/shared/Sidebar";
import { ClientHeader } from "@/components/shared/ClientHeader";
import "@/styles/globals.css";

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

function resolveLanguage(locale: string): Language {
  return locale === "en" || locale === "pl" ? locale : "de";
}

/** Tab title and description follow the active locale. */
export async function generateMetadata({ params }: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { library } = getSharedMessages(resolveLanguage(locale));

  return { title: library.title, description: library.subtitle };
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
        {/*
          Runtime configuration (OIDC issuer/client id, frontend/API URLs) is served
          by a dynamic route handler, never baked into the prerendered HTML: the
          container's environment is not known at CI build time.
        */}
        <script src="/library/runtime-config.js" />
      </head>
      <body className="min-h-full flex bg-[var(--surface-canvas)] text-[var(--text-main)] font-sans antialiased overflow-hidden selection:bg-[var(--primary-main)] selection:text-black">
        <AuthGuard basePath="/library">
          <NextIntlClientProvider locale={locale} messages={messages}>
            <LanguageProvider defaultLanguage={resolveLanguage(locale)}>
              <ThemeProvider defaultMode="dark" defaultVariant="nordic">
                <HouseholdProvider>
                  <Providers>
                    <AppShell header={<ClientHeader />} sidebar={<Sidebar />}>
                      <HouseholdGate>
                        <div className="p-6">{children}</div>
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
