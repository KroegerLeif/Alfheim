import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { LanguageProvider, ThemeProvider, QueryProvider, AuthProvider } from '@/core/providers';
import { Sidebar } from '@/shared/components/Sidebar';
import { Header } from '@/shared/components/Header';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { Suspense } from 'react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Alfheim OS | Dashboard',
  description: 'Central management dashboard for Alfheim OS platform micro-services.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      data-theme="obsidian"
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body 
        className="h-full bg-[var(--surface-canvas)] text-[var(--text-main)] font-sans antialiased overflow-hidden selection:bg-[var(--primary-main)] selection:text-black"
        suppressHydrationWarning
      >
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)]">
            <div className="text-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent mx-auto"></div>
              <p className="text-sm font-mono tracking-wide text-[var(--text-muted)]">
                Initializing platform shell...
              </p>
            </div>
          </div>
        }>
          <AuthProvider>
            <LanguageProvider defaultLanguage="de">
              <ThemeProvider defaultMode="dark" defaultVariant="obsidian">
                <QueryProvider>
                  <div className="flex h-screen w-full overflow-hidden">
                    <Sidebar />
                    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative">
                      <Header />
                      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8 stitch-grid">
                        {children}
                      </main>
                      <BottomNavBar />
                    </div>
                  </div>
                </QueryProvider>
              </ThemeProvider>
            </LanguageProvider>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}
