import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Maintenance Management",
  description: "alfheim Maintenance Management App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
