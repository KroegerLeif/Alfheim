import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { UNIT_CODES, unitLabel } from "../utils/units";

interface UnitSelectorProps {
  /** Stored unit code. */
  value: string;
  onChange: (code: string) => void;
}

/**
 * Custom popover dropdown unit picker for catalog stepper entries. Shows localized unit labels
 * while the selected value stays the stable unit code.
 */
export function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const t = useTranslations("Units");
  const tForm = useTranslations("AddForm");
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={tForm("unitLabel")}
          className={cn(
            "h-10 min-w-[64px] px-2.5 rounded-[8px] flex items-center justify-between gap-1 cursor-pointer transition-all glass-inset",
            open && "glass-active"
          )}
        >
          <span className="font-mono text-xs font-bold leading-none select-none text-foreground/80">
            {unitLabel(value, t)}
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
            {UNIT_CODES.map((code) => (
              <button
                type="button"
                key={code}
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3.5 py-2 text-left cursor-pointer transition-colors font-mono text-[11px] select-none",
                  code === value.toLowerCase()
                    ? "bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                {unitLabel(code, t)}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
