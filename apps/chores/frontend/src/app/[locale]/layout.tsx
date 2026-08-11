import { ReactNode } from "react";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import {
  LanguageProvider,
  ThemeProvider,
} from "@alfheim/shared";
import Providers from "./providers";
import { Sidebar } from "@/components/shared/Sidebar";
import { ClientHeader } from "@/components/shared/ClientHeader";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
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
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
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
                    {/* Reuse shared layout shell from @alfheim/shared */}
                    <ClientHeader />

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
