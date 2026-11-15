import { ReactNode } from "react";
import { createAppMetadata } from "@alfheim/shared";
import "./globals.css";

export const metadata = {
  ...createAppMetadata({ app: "chat" }),
  title: "Alfheim Chat",
  description: "alfheim AI Chat App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
