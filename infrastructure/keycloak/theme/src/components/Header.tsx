import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = "Alfheim Identity", subtitle }: HeaderProps) {
  return (
    <header className="flex flex-col items-center justify-center space-y-3 w-full pb-2">
      <div className="flex items-center justify-between w-full mb-1">
        <div className="flex items-center space-x-2">
          {/* Alfheim Logo Mark */}
          <svg
            className="w-8 h-8 text-blue-600 dark:text-blue-400"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.15" />
            <path
              d="M16 6L24 24H20L16 14L12 24H8L16 6Z"
              fill="currentColor"
            />
          </svg>
          <span className="font-bold text-lg tracking-tight text-text-main">
            ALFHEIM
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* ALFI Mascot Header Illustration */}
      <div className="relative group flex justify-center py-1">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center border border-blue-500/20 shadow-xs transition-transform group-hover:scale-105">
          <svg
            className="w-10 h-10 text-blue-600 dark:text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 7 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-text-main">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
