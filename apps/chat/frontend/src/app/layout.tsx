import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Alfheim Chat",
  description: "alfheim AI Chat App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
