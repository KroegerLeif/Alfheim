import { ReactNode } from "react";
import { createAppMetadata } from "@alfheim/shared";
import "./globals.css";

export const metadata = {
  ...createAppMetadata({ app: "workout" }),
  title: "Workout Tracker",
  description: "alfheim Workout Tracker App",
};

/**
 * Root layout is a pass-through: `[locale]/layout.tsx` owns the <html>/<body>
 * elements so the locale can be applied to the `lang` attribute.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
