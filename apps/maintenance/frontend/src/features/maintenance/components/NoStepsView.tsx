"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

interface NoStepsViewProps {
  noStepsTitle: string;
  noStepsDesc: string;
  closeText: string;
  onClose: () => void;
}

export function NoStepsView({ noStepsTitle, noStepsDesc, closeText, onClose }: NoStepsViewProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 font-sans">
      <div className="bg-[var(--surface-card)] border-[var(--border-subtle)] max-w-md w-full p-8 rounded-2xl shadow-2xl text-center space-y-6">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-black uppercase text-[var(--text-main)] tracking-wide">
            {noStepsTitle}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {noStepsDesc}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
        >
          {closeText}
        </button>
      </div>
    </div>
  );
}
