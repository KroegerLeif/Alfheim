import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppShell, AuthGuard } from '@alfheim/shared';
import { LanguageProvider, ThemeProvider, QueryProvider } from '@/core/providers';
import { AppHeader, AppSidebar } from '@/components/AppChrome';
import { OnboardingGate } from '@/components/OnboardingGate';
import { HOUSEHOLD_BASE_PATH } from '@/lib/routes';
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
  title: 'Alfheim OS | Household',
  description: 'Household, member and role management for Alfheim OS.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        {/*
          Runtime configuration (OIDC issuer/client id, frontend/API URLs) is served
          by a dynamic route handler, never baked into the prerendered HTML: the
          container's environment is not known at CI build time.
        */}
        {/* Must run synchronously before hydration so AuthGuard sees window.__ALFHEIM_ENV__. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`${HOUSEHOLD_BASE_PATH}/runtime-config.js`} />
      </head>
      <body
        className="h-full bg-[var(--surface-canvas)] text-[var(--text-main)] font-sans antialiased overflow-hidden selection:bg-[var(--primary-main)] selection:text-black"
        suppressHydrationWarning
      >
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent mx-auto"></div>
          </div>
        }>
          {/* OIDC redirect URI: <origin>/household/ */}
          <AuthGuard basePath={HOUSEHOLD_BASE_PATH}>
            <LanguageProvider defaultLanguage="de">
              <ThemeProvider defaultMode="dark" defaultVariant="nordic">
                <QueryProvider>
                  <AppShell header={<AppHeader />} sidebar={<AppSidebar />}>
                    <OnboardingGate>
                      <div className="grid grid-cols-12 gap-6 p-4 sm:p-6 md:p-8 stitch-grid">
                        {children}
                      </div>
                    </OnboardingGate>
                  </AppShell>
                </QueryProvider>
              </ThemeProvider>
            </LanguageProvider>
          </AuthGuard>
        </Suspense>
      </body>
    </html>
  );
}
