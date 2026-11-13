import { ReactNode } from "react";
import type { Metadata } from "next";
import { createAppMetadata } from "@alfheim/shared";
import "./globals.css";

/** Favicons and manifest from the shared bundle; the locale layout adds title and description. */
export const metadata: Metadata = createAppMetadata({ app: "maintenance" });

/** Pass-through root layout: the locale layout renders the document and provides the localized metadata. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
