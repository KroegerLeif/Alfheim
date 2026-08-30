import React from "react";
import { Header } from "./Header";

interface CardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export function CardLayout({ children, title, subtitle, footer }: CardLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-surface-canvas">
      <main className="w-full max-w-md bg-surface-card border border-subtle rounded-2xl shadow-lg p-6 sm:p-8 space-y-6 transition-all">
        <Header title={title} subtitle={subtitle} />
        <div className="space-y-4">{children}</div>
        {footer && <footer className="pt-2 border-t border-subtle text-center text-xs text-text-muted">{footer}</footer>}
      </main>
      <footer className="mt-6 text-center text-xs text-text-muted">
        &copy; {new Date().getFullYear()} Alfheim Ecosystem &bull; All rights reserved.
      </footer>
    </div>
  );
}
