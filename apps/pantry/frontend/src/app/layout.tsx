import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Digital Pantry",
  description: "loeger-os Digital Pantry App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
