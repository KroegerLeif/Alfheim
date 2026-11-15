import { ReactNode } from "react";
import type { Metadata } from "next";
import { createAppMetadata } from "@alfheim/shared";
import "./globals.css";

export const metadata: Metadata = createAppMetadata({ app: "shopping" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
