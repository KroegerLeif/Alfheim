import { ReactNode } from "react";
import "./globals.css";

/** Pass-through root layout: the locale layout renders the document and provides the localized metadata. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
