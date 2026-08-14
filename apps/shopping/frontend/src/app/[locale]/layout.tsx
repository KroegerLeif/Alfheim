import { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LanguageProvider, ThemeProvider } from "@alfheim/shared";
import Providers from "./providers";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";

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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans antialiased overflow-hidden selection:bg-primary selection:text-white">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LanguageProvider defaultLanguage={locale as "de" | "en" | "pl"}>
            <ThemeProvider defaultMode="dark" defaultVariant="obsidian">
              <Providers>
                <div className="flex w-full h-screen overflow-hidden">
                  <Sidebar />
                  <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 min-w-0">
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
