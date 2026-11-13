import { ReactNode } from "react";
import { createAppMetadata } from "@alfheim/shared";
import "./globals.css";

export const metadata = {
  ...createAppMetadata({ app: "chores" }),
  title: "Chores Tracker",
  description: "alfheim Chores Tracker App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
