"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Interactive button to switch between Light and Dark modes.
 * Uses next-themes and handles client-side mounting safely.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9 rounded-[8px] glass-inset shrink-0" />;
  }

  // resolvedTheme supports system preferences automatically
  const activeTheme = resolvedTheme || theme;
  const isDark = activeTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer 
                 glass-inset hover:glass-active text-muted-foreground hover:text-foreground 
                 shrink-0 transition-all duration-300"
      aria-label="Toggle visual theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 rotate-0 transition-transform duration-500 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
