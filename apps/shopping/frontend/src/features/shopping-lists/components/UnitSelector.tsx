import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const UNITS = ["Stk", "g", "kg", "ml", "L", "Fl.", "Pkg.", "Bund", "Dose", "Pkt."];

interface UnitSelectorProps {
  value: string;
  onChange: (val: string) => void;
}

/**
 * Custom popover dropdown unit picker for catalog stepper entries.
 */
export function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "h-10 min-w-[64px] px-2.5 rounded-[8px] flex items-center justify-between gap-1 cursor-pointer transition-all glass-inset",
            open && "glass-active"
          )}
        >
          <span className="font-mono text-xs font-bold leading-none select-none text-foreground/80">
            {value}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
            strokeWidth={2.5}
          />
        </button>
      </Popover.Trigger>
      
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 rounded-lg overflow-hidden min-w-[72px] glass-modal border border-border"
        >
          <div className="flex flex-col max-h-[200px] overflow-y-auto scrollbar-none">
            {UNITS.map((unit) => (
              <button
                key={unit}
                onClick={() => {
                  onChange(unit);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3.5 py-2 text-left cursor-pointer transition-colors font-mono text-[11px] select-none",
                  unit === value
                    ? "bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                {unit}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
