import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Digital Pantry",
  description: "alfheim Digital Pantry App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
