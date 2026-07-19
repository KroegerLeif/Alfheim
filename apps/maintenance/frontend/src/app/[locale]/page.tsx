"use client";

import { useTranslations } from "next-intl";

export default function MaintenancePage() {
  const t = useTranslations("Navigation");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white selection:bg-cyan-500 selection:text-black">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
          <svg
            className="h-8 w-8 animate-pulse"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">
            {t("title")}
          </h1>
          <p className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">
            {t("subtitle")}
          </p>
        </div>
        <p className="text-sm text-slate-400 font-medium">
          FastAPI & Next.js microservice architecture with Keycloak security integration, structured telemetry logging, and localized rendering.
        </p>
        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Status: Scaffolding Complete</span>
          <span>loeger-os v0.1</span>
        </div>
      </div>
    </main>
  );
}
