import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Budget & Treasury",
  description: "Alfheim Budget & Treasury Core App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
