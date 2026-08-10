import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Chores Tracker",
  description: "alfheim Chores Tracker App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
