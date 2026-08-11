import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Shopping Checklist",
  description: "alfheim Shopping Checklist App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
