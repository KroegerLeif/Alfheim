import { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
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
import { Sidebar } from "@/shared/layout/Sidebar";
import { Header } from "@/shared/layout/Header";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow-condensed",
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

function resolveLanguage(locale: string): Language {
  return locale === "en" || locale === "pl" ? locale : "de";
}

/** Tab title and description follow the active locale. */
export async function generateMetadata({ params }: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { maintenance } = getSharedMessages(resolveLanguage(locale));

  return { title: maintenance.title, description: maintenance.subtitle };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  // Retrieve the loaded locale messages
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runtime configuration (OIDC issuer/client id, frontend/API URLs) is served
          by a dynamic route handler, never baked into the prerendered HTML: the
          container's environment is not known at CI build time.
        */}
        <script src="/maintenance/runtime-config.js" />
      </head>
      <body
        className="min-h-screen h-screen w-full flex flex-col bg-[var(--surface-canvas)] text-[var(--text-main)] font-sans antialiased overflow-hidden selection:bg-[var(--primary-main)] selection:text-black"
        suppressHydrationWarning
      >
        <AuthGuard basePath="/maintenance">
          <NextIntlClientProvider locale={locale} messages={messages}>
            <LanguageProvider defaultLanguage={resolveLanguage(locale)}>
              <ThemeProvider defaultMode="dark" defaultVariant="nordic">
                <HouseholdProvider>
                  <Providers>
                    <AppShell header={<Header />} sidebar={<Sidebar />}>
                      <HouseholdGate>
                        {children}
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
