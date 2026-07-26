import { ReactNode } from "react";
import { Inter, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import {
  LanguageProvider,
  ThemeProvider,
  BackToDashboard,
  LanguageSwitcher,
  ThemeToggle,
} from "@loeger-os/shared";
import Providers from "./providers";
import { Sidebar } from "@/components/shared/Sidebar";
import { HeaderAuthControls } from "@/components/shared/HeaderAuthControls";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-barlow-condensed",
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
  
  // Retrieve the loaded locale messages
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full flex bg-[var(--surface-canvas)] text-[var(--text-main)] font-sans antialiased overflow-hidden selection:bg-[var(--primary-main)] selection:text-black">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageProvider defaultLanguage={(locale === "en" || locale === "pl") ? locale : "de"}>
            <ThemeProvider defaultMode="dark" defaultVariant="obsidian">
              <Providers>
                <div className="flex w-full min-h-screen">
                  <Sidebar />
                  <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    {/* Top Navigation & Controls Header Bar */}
                    <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 flex items-center justify-between shrink-0 select-none z-10">
                      <BackToDashboard href="http://loeger-os/" />
                      <div className="flex items-center gap-3">
                        <LanguageSwitcher variant="dropdown" />
                        <ThemeToggle showVariantToggle={true} />
                        <HeaderAuthControls />
                      </div>
                    </header>

                    <main className="flex-1 p-6">
                      {children}
                    </main>
                  </div>
                </div>
              </Providers>
            </ThemeProvider>
          </LanguageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
