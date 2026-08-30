import React from "react";
import { CardLayout } from "../components/CardLayout";

interface TemplateProps {
  headerNode?: React.ReactNode;
  displayMessage?: boolean;
  message?: {
    type: "success" | "warning" | "error" | "info";
    summary: string;
  };
  children: React.ReactNode;
}

export function Template({
  headerNode,
  displayMessage = true,
  message,
  children,
}: TemplateProps) {
  return (
    <CardLayout
      title={typeof headerNode === "string" ? headerNode : undefined}
      subtitle="Secure Single Sign-On for Alfheim"
    >
      {displayMessage && message && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border ${
            message.type === "error"
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
              : message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : message.type === "warning"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          }`}
        >
          {message.summary}
        </div>
      )}
      {children}
    </CardLayout>
  );
}
