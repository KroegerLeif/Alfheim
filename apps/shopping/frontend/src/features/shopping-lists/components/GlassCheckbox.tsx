import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassCheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

/**
 * Tactical glassmorphic checkbox displaying custom checking transitions.
 */
export function GlassCheckbox({ checked, onChange, disabled = false }: GlassCheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      disabled={disabled}
      className={cn(
        "w-[22px] h-[22px] rounded-[7px] shrink-0 flex items-center justify-center cursor-pointer",
        "transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-ring",
        checked
          ? "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-800 border-t border-blue-300/50 border-l border-blue-300/30 border-r border-blue-900/40 border-b border-blue-950/50 shadow-md shadow-blue-500/30"
          : "bg-white/5 border border-white/10 dark:border-white/5 hover:border-white/20 shadow-inner"
      )}
      aria-label={checked ? "Mark as unchecked" : "Mark as checked"}
    >
      <Check
        className={cn(
          "h-3 w-3 text-white transition-all duration-300 transform",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
        strokeWidth={3}
      />
    </button>
  );
}
