import { ReactNode } from "react";
import { createAppMetadata } from "@alfheim/shared";
import "./globals.css";

export const metadata = {
  ...createAppMetadata({ app: "pantry" }),
  title: "Digital Pantry",
  description: "alfheim Digital Pantry App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
